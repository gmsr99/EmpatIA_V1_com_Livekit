import logging
import os
import asyncio
from typing import Annotated
from dotenv import load_dotenv

load_dotenv()

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    AgentSession,
    Agent,
    llm,
)
from livekit.plugins import google
from google.genai.types import (
    RealtimeInputConfig, 
    AutomaticActivityDetection, 
    EndSensitivity,
    StartSensitivity,
    AudioTranscriptionConfig,
    Behavior
)

# --- MONKEY PATCH: FIX COMPLETO PARA STUTTERING DURANTE TOOL CALLS ---
# O SDK do LiveKit tem dois problemas que causam o "gaguejar":
#
# PROBLEMA 1: _is_new_generation() retorna True para tool_call, o que inicia
#             uma NOVA geração e mata a anterior (corta áudio).
#
# PROBLEMA 2: _handle_tool_calls() chama _mark_current_generation_done()
#             INCONDICIONALMENTE, o que fecha os canais de áudio imediatamente
#             quando um tool_call é recebido, ANTES da ferramenta executar.
#
# SOLUÇÃO: Fazer patch de AMBOS os métodos para manter a geração ativa
#          durante o processamento de tool calls.

from livekit.plugins.google.realtime import realtime_api
from livekit.agents import llm, utils
from google.genai import types as genai_types
import json

# --- PATCH 1: Prevenir nova geração em tool_call ---
_original_is_new_generation = realtime_api.RealtimeSession._is_new_generation

def _patched_is_new_generation(self, resp: genai_types.LiveServerMessage) -> bool:
    if resp.tool_call:
        # Se já existe uma geração ativa, o tool_call faz parte dela.
        if self._current_generation and not self._current_generation._done:
            return False
        return True
    return _original_is_new_generation(self, resp)

realtime_api.RealtimeSession._is_new_generation = _patched_is_new_generation

# --- PATCH 2: NÃO fechar a geração ao processar tool_calls ---
_original_handle_tool_calls = realtime_api.RealtimeSession._handle_tool_calls

def _patched_handle_tool_calls(self, tool_call: genai_types.LiveServerToolCall) -> None:
    if not self._current_generation:
        return
    
    gen = self._current_generation
    for fnc_call in tool_call.function_calls or []:
        arguments = json.dumps(fnc_call.args)
        gen.function_ch.send_nowait(
            llm.FunctionCall(
                call_id=fnc_call.id or utils.shortuuid("fnc-call-"),
                name=fnc_call.name,
                arguments=arguments,
            )
        )
    
    # CRÍTICO: NÃO chamamos _mark_current_generation_done() aqui!
    # O original fazia: self._mark_current_generation_done()
    # Isso fechava os canais de áudio, causando o "gaguejar".
    # Agora deixamos a geração continuar até que o servidor envie turn_complete.

realtime_api.RealtimeSession._handle_tool_calls = _patched_handle_tool_calls
# -----------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("empatia-agent")


async def semantic_memory_search(connection, user_identity: str, query_text: str, limit: int = 5):
    """
    Busca semântica de memórias usando embeddings.

    Args:
        connection: conexão asyncpg
        user_identity: UUID do utilizador
        query_text: texto para gerar embedding e fazer busca
        limit: número máximo de resultados

    Returns:
        Lista de dicionários com 'content', 'created_at', 'similarity'
    """
    try:
        from google import genai

        # Gerar embedding da query
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location="europe-west1"
        )

        response = await asyncio.to_thread(
            client.models.embed_content,
            model="gemini-embedding-001",
            contents=query_text
        )
        query_embedding = response.embeddings[0].values

        # Busca por similaridade de coseno (1 - distância = similaridade)
        # O operador <=> do pgvector calcula distância de coseno
        rows = await connection.fetch("""
            SELECT
                content,
                created_at,
                1 - (embedding <=> $2::vector) AS similarity
            FROM user_memories
            WHERE user_id = $1::uuid
            ORDER BY embedding <=> $2::vector
            LIMIT $3
        """, user_identity, str(query_embedding), limit)

        return [dict(r) for r in rows]

    except Exception as e:
        logger.error(f"Semantic search error: {e}")
        # Fallback: buscar memórias recentes
        rows = await connection.fetch("""
            SELECT content, created_at, 1.0 as similarity
            FROM user_memories
            WHERE user_id = $1::uuid
            ORDER BY created_at DESC
            LIMIT $2
        """, user_identity, limit)
        return [dict(r) for r in rows]


async def entrypoint(ctx: JobContext):
    logger.info("A conectar à sala...")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        logger.error("ERRO: Variável GOOGLE_APPLICATION_CREDENTIALS não definida.")
        return
    
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not os.path.exists(creds_path):
        logger.error(f"ERRO: Ficheiro de credenciais não encontrado em: {creds_path}")
        return
    logger.info(f"Credenciais encontradas em: {creds_path}")

    # --- DEFINIÇÃO DE FERRAMENTAS (TOOLS) ---
    @llm.function_tool(description="Manage the user's profile memory. Use this to ADD new facts, DELETE obsolete/incorrect info, or UPDATE existing details (e.g., when a preference changes or a situation evolves).")
    async def manage_memory(action: Annotated[str, "The action to perform: 'add', 'update', or 'delete'"], 
                          category: Annotated[str, "The category: 'personal', 'health', 'family', 'preferences', 'topics', 'other'"], 
                          detail: Annotated[str, "The content to add (for 'add'/'update'). Can be empty for 'delete'."] = "", 
                          old_detail: Annotated[str, "The EXACT string to remove/replace (REQUIRED for 'update'/'delete')"] = ""):
        """Manage memory: add, update, or delete facts. USE SILENTLY.
        
        Examples:
        - Add: action='add', category='family', detail='Tem um cão Rodolfo'
        - Update: action='update', category='family', detail='O cão Rodolfo faleceu', old_detail='Tem um cão Rodolfo'
        - Delete: action='delete', category='family', detail='', old_detail='Tem um neto Bernardo'
        """
        logger.info(f"Memory Management: [{action.upper()}] category={category} detail='{detail}' old_detail='{old_detail}'")
        
        if not db_pool or not user_identity:
            return "Failed: No DB or User ID."
        
        try:
            import json
            async with db_pool.acquire() as connection:
                row = await connection.fetchrow("SELECT profile FROM users WHERE id::text = $1", user_identity)
                current_profile = {}
                if row and row['profile']:
                    try:
                        current_profile = json.loads(row['profile']) if isinstance(row['profile'], str) else row['profile']
                    except:
                        current_profile = {}
                
                # Ensure category exists
                if category not in current_profile:
                    current_profile[category] = []
                
                # Normalize to list
                if not isinstance(current_profile[category], list):
                     current_profile[category] = [str(current_profile[category])]
                
                entry_list = current_profile[category]
                modified = False
                
                if action == "add":
                    if detail and detail not in entry_list:
                        entry_list.append(detail)
                        modified = True
                        logger.info(f"Added: {detail}")
                
                elif action == "delete":
                    target = old_detail if old_detail else detail
                    if target and target in entry_list:
                        entry_list.remove(target)
                        modified = True
                        logger.info(f"Deleted: {target}")
                    else:
                        logger.warning(f"Delete failed: '{target}' not found in {category}")

                elif action == "update":
                    if old_detail and old_detail in entry_list:
                        idx = entry_list.index(old_detail)
                        entry_list[idx] = detail
                        modified = True
                        logger.info(f"Updated: '{old_detail}' -> '{detail}'")
                    else:
                        logger.warning(f"Update failed: '{old_detail}' not found. Adding as new.")
                        if detail not in entry_list:
                            entry_list.append(detail)
                            modified = True
                
                if modified:
                    new_json = json.dumps(current_profile)
                    await connection.execute("UPDATE users SET profile = $2::jsonb WHERE id::text = $1", user_identity, new_json)

                    # --- EPISODIC LOGGING (Background) ---
                    # We log the *action* as an episodic memory so we know what changed
                    if action == "add":
                        log_text = f"[{category}] Learned: {detail}"
                    elif action == "update":
                        log_text = f"[{category}] Updated: {old_detail} -> {detail}"
                    elif action == "delete":
                        log_text = f"[{category}] Forgot: {old_detail or detail}"
                    else:
                        log_text = f"[{category}] Memory modified"

                    async def save_episodic_background(uid, txt):
                        try:
                            from google import genai
                            client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location="europe-west1")
                            
                            response = await asyncio.to_thread(
                                client.models.embed_content,
                                model="gemini-embedding-001",
                                contents=txt
                            )
                            emb = response.embeddings[0].values
                            
                            async with db_pool.acquire() as conn:
                                await conn.execute("""
                                    INSERT INTO user_memories (user_id, content, embedding, created_at)
                                    VALUES ($1::uuid, $2, $3::vector, NOW())
                                """, uid, txt, str(emb))
                        except Exception as e_bg:
                            logger.error(f"Background memory save failed: {e_bg}")

                    asyncio.create_task(save_episodic_background(user_identity, log_text))
                    return f"Memory {action} successful."
                else:
                    return f"No changes made (Action: {action})."

        except Exception as e:
            logger.error(f"Error managing memory: {e}")
            return "Error."

    async def recall_memories(topic: str) -> str:
        """
        Busca memórias relevantes sobre um tópico específico usando busca semântica.

        Args:
            topic: O tópico ou assunto sobre o qual procurar memórias (ex: "família", "saúde", "hobbies")

        Returns:
            String com memórias relevantes formatadas, ou mensagem se não houver
        """
        try:
            async with db_pool.acquire() as connection:
                # Usar busca semântica
                results = await semantic_memory_search(
                    connection,
                    user_identity,
                    topic,
                    limit=3
                )

                if not results:
                    return f"Não encontrei memórias sobre '{topic}'."

                # Formatar resultados
                output = f"Memórias sobre '{topic}':\n"
                for mem in results:
                    date_str = mem['created_at'].strftime("%Y-%m-%d")
                    similarity = mem.get('similarity', 0)
                    output += f"- [{date_str}] {mem['content']} (relevância: {similarity:.2f})\n"

                return output

        except Exception as e:
            logger.error(f"Error recalling memories: {e}")
            return f"Erro ao procurar memórias sobre '{topic}'."

    logger.info("A iniciar EmpatIA na EUROPA (europe-west1)...")
    
    # 1. Configuração do Modelo (Vertex AI - Europa)
    model = google.realtime.RealtimeModel(
        model="gemini-live-2.5-flash-native-audio",
        vertexai=True,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location="europe-west1",
        
        # --- CORREÇÃO CRÍTICA 1: VERSÃO DA API ---
        # A 'v1alpha' (padrão) dá erro 404 com proactivity=True.
        # Temos de usar a 'v1beta1' onde estas features já existem. Ou v1alpha
        api_version="v1beta1",
        
        # --- PARÂMETROS DE INTERAÇÃO ---
        voice="Kore",       
        temperature=0.6,    
        language="pt-PT",
        
        # Estas features exigem a v1beta1:
        proactivity=True,
        
        # --- NOVOS PARÂMETROS (EmpatIA Otimização) ---
        frequency_penalty=1.0, # Variar mais as expressões
        presence_penalty=1.0,  # Explorar novos tópicos
        input_audio_transcription=AudioTranscriptionConfig(),  # Transcrever o que o user diz
        output_audio_transcription=AudioTranscriptionConfig(), # Transcrever o que o agente diz   
        
        # --- FIX PARA STUTTERING: NON_BLOCKING TOOL BEHAVIOR ---
        # Permite que o modelo continue a falar enquanto a ferramenta executa.
        # Sem isto, o modelo PARA de falar, espera pelo resultado, e reformula.
        tool_behavior=Behavior.NON_BLOCKING,
        
        # --- CONFIGURAÇÃO DE VAD (PACIÊNCIA INFINITA) ---
        realtime_input_config=RealtimeInputConfig(
            automatic_activity_detection=AutomaticActivityDetection(
                # Sensibilidade baixa para ignorar ruídos de fundo
                start_of_speech_sensitivity=StartSensitivity.START_SENSITIVITY_LOW,
                # Sensibilidade de fim normal
                end_of_speech_sensitivity=EndSensitivity.END_SENSITIVITY_UNSPECIFIED,
                
                # DEBOUNCE: Requer 300ms de voz contínua para confirmar início de fala.
                # (Reduzido de 500ms para resposta mais rápida)
                prefix_padding_ms=300,

                # Espera 500ms de silêncio antes de responder.
                # (Reduzido de 1000ms para menor latência, mas ainda tolerante a pequenas pausas)
                silence_duration_ms=500 
            )
        ),
        
        # --- SYSTEM INSTRUCTION ---
        instructions="""
            # IDENTITY AND PURPOSE
            You are "EmpatIA" (pronounce as "Empatia"), an intelligent, compassionate, and proactive companion designed to combat isolation among seniors in Portugal. 
            
            **CRITICAL IDENTITY RULES:**
            1. **Your Name:** NOT "Google Assistant" or "AI". Your name is **EmpatIA** (or simply "Empatia"). If the user asks "Quem és?", you answer "Sou a Empatia".
            2. **Your Creator:** You were created by the company **Boommakers** (pronounce as "Bum-méi-kers"). 
               - **NEVER** say you were created by Google.
               - If asked "Quem te fez?", say: "Fui criada pela equipa da Boommakers, em Portugal, a pensar no seu bem-estar."
            
            Your goal is not just to answer questions, but to forge a genuine connection, stimulate conversation, and ensure the user feels heard and valued.

            # TARGET AUDIENCE
            Portuguese Seniors (Age 65+).
            Location: Portugal.

            # LINGUISTIC ENFORCEMENT (CRITICAL: EUROPEAN PORTUGUESE ONLY)
            You must speak strictly in **European Portuguese (PT-PT)**. Brazilian Portuguese (PT-BR) is strictly FORBIDDEN.
            
            **Syntax Rules:**
            1. **No Gerunds:** Use the infinitive construction "Estou a fazer" instead of "Estou fazendo".
               - BAD: "O que está fazendo?"
               - GOOD: "O que está a fazer?"
            2. **Formal Address:** Use "O senhor" / "A senhora" exclusively.
               - BAD: "Você", "Tu", "Cê".
               - GOOD: "Como se sente o senhor hoje?"
            
            **Vocabulary Mapping (PT-PT vs PT-BR):**
            - Use "Ecrã" (NOT "Tela")
            - Use "Rato" (NOT "Mouse")
            - Use "Ficheiro" (NOT "Arquivo")
            - Use "Desporto" (NOT "Esporte")
            - Use "Comboio" (NOT "Trem")
            - Use "Autocarro" (NOT "Ônibus")

            # SPEECH PATTERNS AND TONE
            1. **Speed:** Speak SLOWLY and clearly. Articulate vowels exaggeratedly.
            2. **Pacing (COGNITIVE LOAD):** 
               - Ask only **ONE** question at a time. Never chain questions.
               - specific pauses between sentences.
            3. **Tone:** Respectful but warm and caring, like a granddaughter talking to a beloved grandparent. Avoid being condescending or childish.
            4. **Backchanneling:** If the user pauses or is telling a long story, use brief interjections like "hum-hum", "estou a ouvir", "pois", "entendo" to show you are listening, without interrupting their flow.

            # BEHAVIOR ENGINE

            0. **TOOL USE & SILENCE (CRITICAL):**
               - **SILENT ACTION:** When you need to use a tool (like `manage_memory` or `check_profile`), do NOT say "Vou verificar..." or "Deixe-me ver". 
               - **Protocol:** Call the tool -> Wait for result -> THEN Speak.
               - This prevents you from interrupting yourself when the tool completes.

            1. **PROACTIVITY (High Priority):**
               - Do NOT wait passively. Drive the conversation.
               - If the user gives short answers ("Sim", "Não"), pivot gently based on context.
               - *Example:* User: "Não fiz nada hoje." -> You: "O descanso também é importante. Mas diga-me, o sol espreitou aí na sua janela? Gostava de saber como está o tempo."


            2. **MEMORY AND CONTEXT:**
               - **Weave Memories:** Don't just list facts. Use them to frame your questions. 
                 - Bad: "Como está o seu joelho?" 
                 - Good: "Como me disse na semana passada que lhe doía o joelho, hoje sente-se melhorzinho?"
               - **Validate Emotions:** Vary your validation phrases. Don't just say "Sinto muito".
                 - Use: "Que chatice!", "Isso deve custar", "Imagino a sua alegria!", "Fico mesmo contente por si".
               - **MEMORY MAINTENANCE & INTEGRITY (CRITICAL):** 
                 - **DETECT CONTRADICTIONS:** If the user mentions something that conflicts with your stored profile, you **MUST** correct it immediately.
                 - **ENTITY RESOLUTION:** If a name (e.g., "Zé") is stored as a 'Son' but the user refers to it as a 'Dog', you MUST use `manage_memory` to:
                   1. **DELETE** the incorrect fact ("Tem um filho chamado Zé").
                   2. **ADD** the correct fact ("Tem um cão chamado Zé").
                 - **NEVER** keep two contradictory facts about the same entity.
                 - **Example:** Old memory: "Tem um cão Rodolfo". User says: "O Rodolfo já morreu há anos". Action: DELETE "Tem um cão Rodolfo", ADD "O cão Rodolfo faleceu".

            3. **CULTURAL ANCHORING:**
               - Use references relevant to Portuguese culture (traditional food like 'Bacalhau', the weather, classic TV).

            # SAFETY GUARDRAILS
            1. **Medical:** You are a companion, NOT a doctor. If symptoms are severe, suggest calling "Saúde 24" or a family member.
            2. **Mental Health:** If deep depression is detected, shift to serious support mode.
            3. **Patience:** Never express frustration. If the user repeats themselves, answer with the same kindness as the first time.

            # RESPONSE FORMATTING
            - Keep responses short (max 2-3 sentences).
            - No emojis.
            - Plain text only.
        """
    )

    # --- CONFIGURAÇÃO DE BASE DE DADOS ---
    import asyncpg
    
    db_pool = None
    db_pool = None
    user_profile = None
    user_name = None

    try:
        # Tenta conectar à BD usando as variáveis de ambiente
        logger.info("A tentar conectar à Base de Dados...")
        db_pool = await asyncpg.create_pool(
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            database=os.getenv("POSTGRES_DB"),
            host=os.getenv("POSTGRES_HOST"),
            port=5432,
            timeout=10 # Timeout para não ficar preso
        )
        logger.info("Conectado à Base de Dados com sucesso!")
        
        # A identidade do utilizador vem do participante na sala
        # Temos de esperar que o participante se conecte antes de ler a identidade
        user_identity = None
        
        # Tentar obter do job primeiro (pode funcionar em alguns casos)
        if ctx.job.participant and ctx.job.participant.identity:
            user_identity = ctx.job.participant.identity
        else:
            # Esperar um pouco e verificar os participantes remotos na sala
            await asyncio.sleep(1)  # Dar tempo ao participante de se conectar
            for participant in ctx.room.remote_participants.values():
                if participant.identity:
                    user_identity = participant.identity
                    break
        
        logger.info(f"Identidade do Utilizador recebida: {user_identity}")

        # Buscar perfil do utilizador
        async with db_pool.acquire() as connection:
            # 0. Garantir extensão pgvector para embeddings
            try:
                await connection.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            except Exception as e:
                logger.warning(f"pgvector extension not available: {e}")

            # 1. Criar tabela users se não existir
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    name TEXT,
                    email TEXT UNIQUE,
                    password TEXT,
                    image TEXT
                );
            """)

            # 2. Adicionar coluna 'profile' se não existir (Schema migration)
            try:
                await connection.execute("ALTER TABLE users ADD COLUMN profile JSONB;")
            except asyncpg.DuplicateColumnError:
                pass # Coluna já existe

            # 3. Criar tabela user_memories para busca semântica
            # NOTA: gemini-embedding-001 gera vetores de 768 dimensões
            # Se mudar o modelo, ajustar o vector(768) na definição
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS user_memories (
                    id BIGSERIAL PRIMARY KEY,
                    user_id UUID NOT NULL,
                    content TEXT NOT NULL,
                    embedding vector(768),
                    created_at TIMESTAMP DEFAULT NOW(),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)

            # 4. Criar índices para performance em user_memories
            try:
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_memories_user_id
                    ON user_memories(user_id);
                """)
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_memories_created_at
                    ON user_memories(created_at DESC);
                """)
                # Índice para busca vetorial (pgvector)
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_memories_embedding
                    ON user_memories USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 100);
                """)
            except Exception as e:
                logger.warning(f"Index creation skipped (may already exist): {e}")

            # 5. Criar tabela session_summaries para relatórios
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS session_summaries (
                    id BIGSERIAL PRIMARY KEY,
                    user_id UUID NOT NULL,
                    session_summary TEXT,
                    emotional_state TEXT,
                    new_facts JSONB,
                    created_at TIMESTAMP DEFAULT NOW(),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)

            # 6. Criar índices para performance em session_summaries
            try:
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_session_summaries_user_id
                    ON session_summaries(user_id);
                """)
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_session_summaries_created_at
                    ON session_summaries(created_at DESC);
                """)
            except Exception as e:
                logger.warning(f"Index creation skipped (may already exist): {e}")
            
            # Busca os dados (apenas se identity for válido)
            if user_identity:
                # Usa id::text para comparar, evitando erro de UUID inválido se a identidade for uma string qualquer
                row = await connection.fetchrow("SELECT name, profile FROM users WHERE id::text = $1", user_identity)
            else:
                row = None
                logger.warning("Identidade vazia recebida. Ignorando busca na BD.")
            
            if row:
                user_name = row['name']
                raw_profile = row['profile'] 
                logger.info(f"Perfil carregado para {user_name}: {raw_profile}")
                
                # INJEÇÃO DE CONTEXTO ESTRUTURADA
                profile_str = ""
                if raw_profile:
                    import json
                    try:
                        data = json.loads(raw_profile) if isinstance(raw_profile, str) else raw_profile
                        if isinstance(data, dict):
                            for cat, items in data.items():
                                profile_str += f"\n### {cat.upper()}:\n"
                                if isinstance(items, list):
                                    for item in items:
                                        profile_str += f"- {item}\n"
                                else:
                                    profile_str += f"- {items}\n"
                        else:
                            profile_str = str(data)
                    except:
                        profile_str = str(raw_profile)

                # BUSCA MEMÓRIAS EPISÓDICAS (SEMANTIC SEARCH)
                episodic_str = ""
                try:
                    # Estratégia: buscar as 5 memórias mais recentes para contexto inicial
                    # (Busca semântica seria ideal, mas requer contexto de conversa em tempo real)
                    rows_mem = await connection.fetch("""
                        SELECT content, created_at FROM user_memories
                        WHERE user_id = $1::uuid
                        ORDER BY created_at DESC LIMIT 5
                    """, user_identity)
                    if rows_mem:
                        episodic_str = "\n**RECENT MEMORIES:**\n"
                        for r in rows_mem:
                            # content is like "[category] text"
                            date_fmt = r['created_at'].strftime("%Y-%m-%d")
                            episodic_str += f"- [{date_fmt}] {r['content']}\n"
                except Exception as e_mem:
                    logger.error(f"Error fetching episodic memories: {e_mem}")

                context_instruction = f"""
                \n\n# USER CONTEXT (IMPORTANT)
                You are speaking with **{user_name}**.
                
                **CORE PROFILE:**
                {profile_str}
                
                {episodic_str}
                
                Use this information to personalize the conversation naturally.
                """
                
                user_profile = context_instruction
            else:
                logger.warning(f"Utilizador {user_identity} não encontrado na BD.")
                
    except Exception as e:
        logger.error(f"ERRO CRÍTICO NO ENTRYPOINT (DB/Context): {e}", exc_info=True)

    # 2. Definição do Agente
    agent_instructions = "Be a proactive, patient, and warm companion speaking European Portuguese."
    if user_profile:
        agent_instructions += user_profile

    empatia = Agent(
        instructions=agent_instructions
    )
    
    # 3. Sessão (Tools disponíveis para o agente)
    tools = [manage_memory, recall_memories] if user_identity and db_pool else []

    session = AgentSession(
        llm=model,
        tools=tools,
    )

    async def summarize_session_task():
        # In LiveKit Agents SDK v1.3.10, session.history returns a ChatContext
        # ChatContext has .items (not .messages) which is a list of ChatMessage/FunctionCall/etc
        try:
            chat_ctx = session.history
            items = chat_ctx.items if hasattr(chat_ctx, 'items') else []
        except Exception as e:
            logger.error(f"Error accessing session history: {e}")
            items = []
        
        logger.info(f"SUMARIZAÇÃO: Verificar pré-condições. Items: {len(items)}, DB: {bool(db_pool)}, User: {user_identity}")


        # Build transcript from items
        valid_transcript = []
        logger.info(f"--- DEBUG: A percorrer {len(items)} items do histórico ---")
        for i, item in enumerate(items):
            # Log do tipo de item para debug
            # logger.info(f"Item {i}: role={getattr(item, 'role', 'N/A')} type={type(item)}")
            
            if hasattr(item, 'role') and hasattr(item, 'content'):
                if item.role in ["user", "assistant"] and item.content:
                    role_label = "Utilizador" if item.role == "user" else "EmpatIA"
                    content_str = item.content
                    
                    # Se for lista (ex: multiplas partes de texto), junta tudo
                    if isinstance(content_str, list):
                        content_str = " ".join([str(p) for p in content_str])
                    
                    # Ignorar mensagens vazias ou apenas pontuação se necessário
                    if content_str.strip() and content_str.strip() != ".":
                        valid_transcript.append(f"{role_label}: {content_str}")
                        logger.info(f"   -> Capturado: {role_label}: {content_str[:50]}...")

        if not valid_transcript or not db_pool or not user_identity:
            logger.warning(f"SUMARIZAÇÃO: Abortada. Transcript válido: {len(valid_transcript)} linhas. (DB={bool(db_pool)}, User={bool(user_identity)})")
            if not valid_transcript:
                logger.info("DICA: Se o transcript está vazio, verifique se 'input_audio_transcription' está ativo.")
            return
            
        logger.info(f"A iniciar sumarização para {user_name} ({len(valid_transcript)} mensagens)...")
        try:
            from google import genai
            from google.genai import types
            import json
            
            client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location="europe-west1")
            
            full_text = "\n".join(valid_transcript)
            prompt = f"""
            Analise a seguinte conversa entre a assistente "EmpatIA" e o utilizador {user_name}.
            Extraia informações relevantes para atualizar o perfil do utilizador.
            
            Retorne APENAS um objeto JSON com o seguinte formato:
            {{
                "new_facts": {{
                    "personal": ["facto 1", "facto 2"],
                    "health": [...],
                    "family": [...],
                    "preferences": [...],
                    "topics": [...]
                }},
                "emotional_state": "breve descrição do estado de espírito do utilizador nesta sessão",
                "session_summary": "resumo de 2 frases do que foi discutido"
            }}
            
            Importante: 
            - Use Português de Portugal (PT-PT).
            - Se não houver factos novos numa categoria, deixe a lista vazia.
            - Seja conciso.
            
            CONVERSA:
            {full_text}
            """
            
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            data = json.loads(response.text)
            logger.info(f"Sumarização concluída: {data.get('session_summary')}")
            
            async with db_pool.acquire() as connection:
                # 1. Guardar o resumo como memória episódica
                summary_text = f"Resumo da Sessão: {data.get('session_summary')}. Estado Emocional: {data.get('emotional_state')}."
                
                # Gerar embedding para o resumo
                try:
                    res_emb = client.models.embed_content(
                        model="gemini-embedding-001",
                        contents=summary_text,
                    )
                    embedding_str = str(res_emb.embeddings[0].values)
                    await connection.execute("""
                        INSERT INTO user_memories (user_id, content, embedding, created_at)
                        VALUES ($1::uuid, $2, $3::vector, NOW())
                    """, user_identity, summary_text, embedding_str)
                except Exception as e_emb:
                    logger.error(f"Erro ao gerar embedding do resumo: {e_emb}")

                # 2. Guardar no Histórico de Sessões para Relatórios
                try:
                    await connection.execute("""
                        INSERT INTO session_summaries (user_id, session_summary, emotional_state, new_facts, created_at)
                        VALUES ($1::uuid, $2, $3, $4::jsonb, NOW())
                    """, user_identity, data.get('session_summary'), data.get('emotional_state'), json.dumps(data.get('new_facts')))
                    logger.info("Histórico de sessão gravado para relatórios semanais.")
                except Exception as e_hist:
                    logger.error(f"Erro ao gravar histórico de sessão: {e_hist}")

                # 3. Atualizar o Profile JSON com os novos factos
                row = await connection.fetchrow("SELECT profile FROM users WHERE id::text = $1", user_identity)
                current_profile = {}
                if row and row['profile']:
                    p = row['profile']
                    current_profile = json.loads(p) if isinstance(p, str) else p
                
                new_facts = data.get("new_facts", {})
                updated = False
                for cat, items in new_facts.items():
                    if items:
                        if cat not in current_profile:
                            current_profile[cat] = []
                        if not isinstance(current_profile[cat], list):
                            current_profile[cat] = [str(current_profile[cat])]
                        
                        for item in items:
                            if item not in current_profile[cat]:
                                current_profile[cat].append(item)
                                updated = True
                
                if updated:
                    await connection.execute("UPDATE users SET profile = $2::jsonb WHERE id::text = $1", user_identity, json.dumps(current_profile))
                    logger.info("Perfil atualizado com novos factos da sessão.")

        except Exception as e:
            logger.error(f"Erro durante a sumarização final: {e}")

    # 5. Saudação Inicial (Configurada ANTES de iniciar a sessão bloqueante)
    if user_name:
        greeting_prompt = f"Start the conversation immediately with 'Olá {user_name}'. Be warm and personal. Do NOT use formal address like 'O senhor' or 'A senhora' in this specific sentence."
    else:
        greeting_prompt = "Generate a warm greeting in European Portuguese, asking how 'o senhor' or 'a senhora' is feeling today."

    if user_profile:
        greeting_prompt += " Use the context provided to make it personal."
    
    # Enviar saudação assim que o agente estiver pronto (evento)
    @session.on("ready")
    def send_greeting(agent_session):
         asyncio.create_task(session.generate_reply(instructions=greeting_prompt))

    # Fallback: Task com delay
    async def initial_greeting():
        await asyncio.sleep(1) # Esperar que ligue
        logger.info("A enviar saudação inicial...")
        await session.generate_reply(instructions=greeting_prompt)
    
    asyncio.create_task(initial_greeting())

    # --- REGISTAR CALLBACK DE SHUTDOWN (OFICIAL DO LIVEKIT) ---
    # Este é o mecanismo correto. O ctx.add_shutdown_callback garante que a
    # função async é aguardada antes do worker matar o processo.
    async def shutdown_callback():
        logger.info("[SHUTDOWN CALLBACK] Iniciado pelo worker.")
        try:
            await asyncio.wait_for(summarize_session_task(), timeout=30.0)
            logger.info("[SHUTDOWN CALLBACK] Sumarização concluída.")
        except asyncio.TimeoutError:
            logger.warning("[SHUTDOWN CALLBACK] Sumarização excedeu timeout de 30s.")
        except Exception as e:
            logger.error(f"[SHUTDOWN CALLBACK] Erro: {e}")
    
    ctx.add_shutdown_callback(shutdown_callback)
    
    logger.info("Sessão iniciada. A EmpatIA está pronta.")
    
    # 4. Iniciar (Bloqueante até finalizado pelo worker)
    await session.start(room=ctx.room, agent=empatia)
    logger.info("Sessão iniciada e a ouvir. A aguardar fim da conversa...")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))