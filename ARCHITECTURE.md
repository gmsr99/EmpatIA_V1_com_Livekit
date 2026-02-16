# Arquitetura do EmpatIA - Documentação Completa

**Data:** 2026-02-16
**Versão:** 2.1 (Session Resumption + Context Compression)

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Componentes do Sistema](#componentes-do-sistema)
4. [Arquitetura de Memória](#arquitetura-de-memória)
5. [Fluxo de Dados](#fluxo-de-dados)
6. [Agentes e Funções](#agentes-e-funções)
7. [Base de Dados](#base-de-dados)
8. [Integrações Externas](#integrações-externas)
9. [Deployment](#deployment)

---

## Visão Geral

**EmpatIA** é um assistente de voz compassivo projetado para combater a solidão entre idosos portugueses (65+). O sistema usa **voz nativa do Google Gemini** (sem intermediários TTS/STT) para conversas naturais em **Português Europeu (PT-PT)**.

### Princípios de Design

1. **Conversação Natural:** Voz em tempo real com baixa latência (europe-west1)
2. **Memória Persistente:** Sistema dual (perfil estruturado + memórias episódicas)
3. **Busca Semântica:** RAG com embeddings otimizados para português
4. **Zero Interrupções:** Escrita de memórias movida para pós-conversa (evita stuttering)
5. **GDPR-Compliant:** Dados hospedados na Europa, controlo total pelo utilizador

---

## Stack Tecnológica

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Deploy:** Vercel
- **Auth:** NextAuth.js
- **UI:** React + TailwindCSS
- **Voice Client:** LiveKit Client SDK

### Backend
- **Runtime:** Python 3.12
- **Framework:** LiveKit Agents SDK v1.3.10
- **LLM:** Google Gemini 2.5 Flash (native audio)
- **Embeddings:** `text-multilingual-embedding-002` (768 dims, optimizado PT)
- **Deploy:** Docker na VPS (72.60.89.5, Germany)

### Infraestrutura
- **Realtime Voice:** LiveKit Cloud (empatia-dvfazc45.livekit.cloud, região Germany 2)
- **Base de Dados:** PostgreSQL 15+ com extensão **pgvector** (VPS)
- **Cloud AI:** Google Vertex AI (europe-west1)
- **Automação:** N8N (triggers de session_summaries)

---

## Componentes do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         UTILIZADOR (Idoso)                      │
│                    Browser ou App (iOS/Android)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ WebRTC (voz bidirecional)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LIVEKIT CLOUD (Germany 2)                  │
│  - Rooms (voice_assistant_room_<user_id>)                      │
│  - WebRTC bridge                                                │
│  - Audio streaming                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ LiveKit SDK
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (VPS Docker - agent.py)                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ AGENTE DE CONVERSA (Gemini native audio model)      │      │
│  │  - Ouve e fala em tempo real                         │      │
│  │  - 1 Tool: recall_memories (busca RAG, read-only)    │      │
│  │  - Memória de sessão nativa (não precisa de tools)   │      │
│  │  - Monkey patches para evitar stuttering             │      │
│  └─────────────────────────────────────────────────────┘      │
│                             │                                   │
│  ┌─────────────────────────────────────────────────────┐      │
│  │ AGENTE DE ANÁLISE (Gemini 2.0 Flash text)           │      │
│  │  - Executado NO PÓS-CONVERSA (shutdown callback)    │      │
│  │  - Analisa transcrição completa                      │      │
│  │  - Extrai: individual_memories, new_facts,           │      │
│  │            corrections, emotional_state              │      │
│  │  - Gera embeddings (batch)                           │      │
│  │  - Atualiza BD                                       │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
└────────────┬────────────────────────────────┬──────────────────┘
             │                                │
             │ asyncpg                        │ Google Vertex AI
             ▼                                ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│   PostgreSQL + pgvector  │    │  europe-west1               │
│   (VPS Docker)           │    │  - Gemini models            │
│   - users                │    │  - Embedding API            │
│   - user_memories        │    │  - vertex-key.json auth     │
│   - session_summaries    │    └─────────────────────────────┘
└──────────┬───────────────┘
           │
           │ Trigger/Webhook
           ▼
┌──────────────────────────┐
│         N8N              │
│  - Relatórios semanais   │
│  - Alertas de saúde      │
│  - Email notifications   │
└──────────────────────────┘
```

---

## Arquitetura de Memória

### Problema Original (Antes do Refactoring)

O agente tinha a tool `manage_memory` **durante a conversa**. Sempre que o Gemini native audio model chamava esta tool:
- **Stuttering severo:** o áudio cortava, retomava, e repetia frases
- **Latência alta:** escrita na BD + geração de embeddings bloqueava o fluxo
- **UX horrível:** idosos ficavam confusos com as interrupções

### Solução: "Read During, Write After"

#### DURANTE A CONVERSA (Real-time)
```python
# Agente tem 1 tool READ-ONLY:
tools = [recall_memories]  # Busca semântica de memórias antigas

# O modelo LEMBRA TUDO nativamente durante a sessão
# Não precisa de "salvar" - usa memória de sessão do Gemini
```

**Tool `recall_memories`:**
- **Descrição:** "Use ONLY when user references something from a PREVIOUS conversation"
- **Quando NÃO usar:** Tópicos da sessão atual, início de conversa
- **Restrições:** Máximo 1 chamada por turn, timeout de 5s
- **Performance:** Client cached (sem re-criar `genai.Client()`), embeddings com timeout 4s

#### PÓS-CONVERSA (Análise Assíncrona)

```python
# Callback de shutdown (executado quando o utilizador desliga):
async def shutdown_callback():
    await summarize_session_task()
    # Timeout: 60s
```

**Agente de Análise (`summarize_session_task`):**

1. **Lê transcrição completa** do histórico da sessão:
   ```python
   session.history.items → List[ChatMessage]
   # Cada item tem: role="user"|"assistant", content="texto transcrito"
   ```

2. **Envia para Gemini 2.0 Flash** com prompt estruturado:
   ```python
   prompt = f"""
   Analise a conversa entre EmpatIA e {user_name}.

   PERFIL ATUAL: {current_profile_json}

   Retorne JSON:
   {{
     "individual_memories": [
       "O utilizador mencionou que o neto João vai emigrar para a França",
       "Sente dores nos joelhos quando o tempo está húmido"
     ],
     "new_facts": {{
       "family": ["Tem um neto chamado João"],
       "health": ["Sofre de artrite nos joelhos"]
     }},
     "corrections": [
       {{
         "category": "family",
         "old_fact": "O cão Rodolfo está vivo",
         "new_fact": "O cão Rodolfo faleceu há 3 anos",
         "action": "update"
       }}
     ],
     "emotional_state": "nostálgico, preocupado com a emigração do neto",
     "session_summary": "Conversou sobre a decisão do neto de emigrar..."
   }}
   """
   ```

3. **Gera embeddings em batch:**
   ```python
   # Uma única chamada API para todas as memórias
   emb_response = client.models.embed_content(
       model="text-multilingual-embedding-002",
       contents=individual_memories  # Lista de strings
   )
   ```

4. **Atualiza 3 destinos:**

   | Tabela | Dados Guardados | Propósito |
   |--------|-----------------|-----------|
   | `user_memories` | **Memórias individuais** (1 row por memória) com embedding | Busca semântica futura (`recall_memories`) |
   | `users.profile` | **Factos estruturados** por categoria (JSONB) | Contexto carregado no início de CADA conversa |
   | `session_summaries` | **Resumo da sessão** + emotional_state + new_facts | Triggers para N8N (relatórios, alertas) |

---

## Fluxo de Dados

### 1. Início da Conversa

```
User abre app → Frontend (Vercel)
  ↓
NextAuth verifica sessão → user_id
  ↓
Frontend pede token LiveKit → /api/connection-details
  ↓
Backend cria room → voice_assistant_room_{user_id}
  ↓
Frontend conecta via WebRTC → LiveKit Cloud
  ↓
LiveKit dispara job request → Backend Docker
  ↓
Backend (agent.py):
  1. Conecta à sala (auto_subscribe=AUDIO_ONLY)
  2. Carrega perfil do utilizador (users.profile)
  3. Carrega 5 memórias recentes (user_memories ORDER BY created_at DESC)
  4. Injeta no system prompt do Gemini
  5. Inicia sessão com tool [recall_memories]
  6. Envia saudação inicial: "Olá {nome}"
```

### 2. Durante a Conversa

```
User fala → LiveKit Cloud → Backend agent
  ↓
Gemini native audio:
  - Transcreve automaticamente (input_audio_transcription=True)
  - Processa com memória de sessão nativa
  - Pode chamar recall_memories SE necessário (raro)
  ↓
Gemini gera resposta em voz → LiveKit Cloud → User
```

**VAD (Voice Activity Detection):**
- `silence_duration_ms=1000` - Espera 1s de silêncio antes de responder
- `end_of_speech_sensitivity=LOW` - Menos agressivo a cortar
- `prefix_padding_ms=300` - Requer 300ms de voz contínua

**Tool `recall_memories` (quando chamada):**
```
Gemini decide chamar recall_memories(topic="família")
  ↓
Backend:
  1. Gera embedding do topic (4s timeout)
  2. Busca pgvector: SELECT WHERE embedding <=> query
  3. Retorna top 3 memórias (5s timeout total)
  ↓
Gemini usa resultado na resposta
```

### 3. Fim da Conversa

```
User desliga → LiveKit Cloud → participant.disconnect
  ↓
SDK detecta disconnect → ctx.shutdown_callback
  ↓
Backend (shutdown_callback com timeout 60s):
  1. summarize_session_task() inicia
  2. Lê session.history.items (transcrição completa)
  3. Envia para Gemini 2.0 Flash (análise text-based)
  4. Recebe JSON estruturado
  5. Gera embeddings batch (3-15 memórias)
  6. INSERT em user_memories (múltiplas rows)
  7. INSERT em session_summaries (1 row - trigger N8N)
  8. UPDATE users.profile (merge new_facts + apply corrections)
  ↓
Processo termina
```

---

## Agentes e Funções

### Agente 1: Conversação (Gemini 2.5 Flash Native Audio)

**Ficheiro:** `agent.py` (linhas 202-570)

**Configuração:**
```python
model = google.realtime.RealtimeModel(
    model="gemini-live-2.5-flash-native-audio",
    vertexai=True,
    location="europe-west1",
    api_version="v1beta1",

    # Parâmetros de criatividade
    temperature=1.0,
    frequency_penalty=1.0,
    presence_penalty=1.0,

    # Transcrição automática
    input_audio_transcription=AudioTranscriptionConfig(),
    output_audio_transcription=AudioTranscriptionConfig(),

    # NON_BLOCKING: não pausa ao chamar tool
    tool_behavior=Behavior.NON_BLOCKING,

    # Proatividade (faz perguntas, não espera passivamente)
    proactivity=True,

    # VAD configurado para idosos
    realtime_input_config=RealtimeInputConfig(...),

    # Session Resumption (v2.1) - Retomar sessões em caso de desconexão
    session_resumption=SessionResumptionConfig(transparent=True),

    # Context Window Compression (v2.1) - Comprimir contexto para sessões longas
    context_window_compression=ContextWindowCompressionConfig(enabled=True)
)
```

**Novas Features (v2.1):**
- **Session Resumption:** Permite reconectar sem perder contexto (útil para internet instável de idosos)
- **Context Window Compression:** Comprime automaticamente conversas longas (>10min) sem perder informação crítica

**Tools Disponíveis:**
- `recall_memories(topic: str)` - Busca semântica de memórias antigas

**System Instruction:** (800+ linhas de prompt)
- Identidade: "Sou a Empatia, criada pela Boommakers"
- Idioma: Português Europeu (PT-PT) exclusivo
- Tom: Neta carinhosa, respeitosa mas calorosa
- Proatividade: Fazer perguntas, não esperar passivamente
- Memória: NÃO mencionar "vou guardar isso" (automático)

**Monkey Patches Aplicados:** (linhas 28-82)
- Previne stuttering durante tool calls
- Mantém geração ativa enquanto tool executa
- Corrige bugs do LiveKit SDK v1.3.10

**Responsabilidades:**
1. ✅ Ouvir e responder em tempo real
2. ✅ Usar contexto (perfil + 5 memórias recentes)
3. ✅ Buscar memórias antigas SE necessário (recall_memories)
4. ❌ NÃO guardar memórias (moved to post-conversation)

---

### Agente 2: Análise (Gemini 2.0 Flash Text)

**Ficheiro:** `agent.py` → `summarize_session_task()` (linhas 571-787)

**Configuração:**
```python
client = _get_genai_client()  # Cached, reutilizado

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json"
    )
)
```

**Input:**
- Transcrição completa da conversa (session.history.items)
- Perfil atual do utilizador (para detetar contradições)

**Output (JSON):**
```json
{
  "individual_memories": [
    "Memória 1 auto-contida",
    "Memória 2 auto-contida"
  ],
  "new_facts": {
    "personal": ["facto novo"],
    "health": [],
    "family": ["facto familiar"],
    "preferences": [],
    "topics": []
  },
  "corrections": [
    {
      "category": "family",
      "old_fact": "facto errado no perfil",
      "new_fact": "facto correto da conversa",
      "action": "update|delete"
    }
  ],
  "emotional_state": "descrição breve",
  "session_summary": "resumo 2-3 frases"
}
```

**Responsabilidades:**
1. ✅ Extrair 3-15 memórias individuais auto-contidas
2. ✅ Identificar factos NOVOS (não duplicar os existentes)
3. ✅ Detetar contradições (corrections)
4. ✅ Gerar embeddings batch
5. ✅ Persistir em 3 tabelas (user_memories, users.profile, session_summaries)

**Performance:**
- Timeout: 60s total (se exceder, logs warning mas não bloqueia shutdown)
- Batch embedding: 1 API call para todas as memórias (fallback: 1 a 1)
- Client cached: `_get_genai_client()` (evita re-criar SSL/auth)

---

## Base de Dados

**PostgreSQL 15+ com extensão pgvector** (VPS Docker)

### Tabela: `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    profile JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
```

**`profile` (JSONB) - Estrutura:**
```json
{
  "personal": [
    "Tem uma bicicleta amarela",
    "Vive em Lisboa há 40 anos"
  ],
  "health": [
    "Sofre de artrite nos joelhos",
    "Toma medicação para tensão alta"
  ],
  "family": [
    "Tem 3 filhos",
    "Neto João vai emigrar para França"
  ],
  "preferences": [
    "Gosta de ouvir fado",
    "Prefere chá a café"
  ],
  "topics": [
    "Interessa-se por jardinagem",
    "Gosta de política"
  ]
}
```

**Uso:**
- Carregado no **início de CADA conversa** (injetado no system prompt)
- Atualizado no **pós-conversa** (merge de new_facts + corrections)
- Permite ao agente "lembrar" factos permanentes sem buscar BD

---

### Tabela: `user_memories`

```sql
CREATE TABLE user_memories (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),  -- text-multilingual-embedding-002
    memory_type TEXT DEFAULT 'fact',
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX idx_user_memories_created_at ON user_memories(created_at DESC);
CREATE INDEX idx_user_memories_embedding ON user_memories
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Dados guardados:**
- 1 row por **memória individual** (3-15 por conversa)
- Cada memória é auto-contida: "O utilizador mencionou que o neto João vai emigrar para a França"
- Embedding de 768 dimensões (otimizado para busca semântica)

**Uso:**
- **Carregamento inicial:** 5 memórias mais recentes (ORDER BY created_at DESC)
- **Durante conversa:** Busca semântica via `recall_memories(topic)` (pgvector cosine similarity)
- **Pós-conversa:** Inserts de novas memórias com embeddings

**Query de busca semântica:**
```sql
SELECT
    content,
    created_at,
    1 - (embedding <=> $query_embedding::vector) AS similarity
FROM user_memories
WHERE user_id = $user_id
ORDER BY embedding <=> $query_embedding::vector
LIMIT 3;
```

**Operador `<=>`:** Distância de coseno do pgvector
**`1 - distância`:** Converte em score de similaridade (0 a 1)

---

### Tabela: `session_summaries`

```sql
CREATE TABLE session_summaries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    session_summary TEXT,
    emotional_state TEXT,
    new_facts JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_session_summaries_user_id ON session_summaries(user_id);
CREATE INDEX idx_session_summaries_created_at ON session_summaries(created_at DESC);
```

**Dados guardados:**
- 1 row por **conversa completa**
- Resume o que foi discutido + estado emocional + factos novos

**Uso:**
- **Triggers N8N:** Inserts nesta tabela disparam workflows (relatórios semanais, alertas)
- **Dashboard:** Histórico de sessões para familiares/cuidadores
- **Analytics:** Padrões de conversação, tópicos frequentes

**Exemplo de row:**
```json
{
  "id": 42,
  "user_id": "214dfbc0-7570-44ef-9968-10ddc67bfb45",
  "session_summary": "Conversou sobre a decisão do neto de emigrar para França. Expressou saudades antecipadas mas orgulho na escolha dele.",
  "emotional_state": "nostálgico, preocupado, mas orgulhoso",
  "new_facts": {
    "family": ["Neto João vai emigrar para França em Março"],
    "health": ["Joelhos pioraram com o frio"]
  },
  "created_at": "2026-02-13 18:30:00"
}
```

---

## Integrações Externas

### 1. LiveKit Cloud

**Região:** Germany 2 (baixa latência para Portugal)
**URL:** `wss://empatia-dvfazc45.livekit.cloud`

**Responsabilidades:**
- WebRTC signaling e media routing
- Rooms dinâmicas por utilizador (`voice_assistant_room_{user_id}`)
- Bridge entre frontend e backend agent

**Configuração no Backend:**
```python
await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
```

**Tokens:**
- Frontend pede token via `/api/connection-details`
- Token inclui: room_name, user_identity, expiry
- Backend valida e cria room sob demanda

---

### 2. Google Vertex AI

**Região:** europe-west1 (GDPR-compliant)
**Autenticação:** Service Account JSON (`vertex-key.json`)

**Modelos Usados:**

| Modelo | Dimensão Output | Latência | Uso |
|--------|-----------------|----------|-----|
| `gemini-live-2.5-flash-native-audio` | Audio stream | <500ms | Conversação real-time |
| `gemini-2.0-flash` | Text (JSON) | ~2-5s | Análise pós-conversa |
| `text-multilingual-embedding-002` | 768 dims | ~200ms/batch | Embeddings (otimizado PT) |

**Client Cached:**
```python
_genai_client = None

def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        from google import genai
        _genai_client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location="europe-west1"
        )
    return _genai_client
```

**Por que cached?**
- Criar novo client a cada chamada = 500-1000ms (SSL handshake + auth token)
- Com cache: primeira chamada lenta, resto instant

---

### 3. N8N (Automação)

**Trigger:** INSERT em `session_summaries`

**Workflows Configurados:**
1. **Relatório Semanal:** Email para familiares com resumo das conversas
2. **Alerta de Saúde:** Se `emotional_state` contém palavras-chave ("dor severa", "deprimido"), notifica cuidador
3. **Inatividade:** Se não há sessões há >7 dias, lembrete automático

**Configuração:**
- PostgreSQL trigger → Webhook N8N
- N8N lê `new_facts` e `emotional_state` do payload
- Envia emails via SMTP (Mailgun/SendGrid)

---

## Deployment

### Frontend (Vercel)

**Pasta:** `empatia-frontend/`

```bash
# Deploy automático via GitHub integration
git push origin main → Vercel auto-deploy
```

**Variáveis de Ambiente (Vercel):**
- `NEXTAUTH_SECRET` - Auth JWT secret
- `NEXTAUTH_URL` - https://empatia.app (production)
- `DATABASE_URL` - PostgreSQL connection string
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit secret
- `LIVEKIT_URL` - wss://empatia-dvfazc45.livekit.cloud

---

### Backend (VPS Docker)

**Pasta:** `Empatia_Backend_Clean/`

**VPS:** 72.60.89.5 (Germany)
**SSH:** `ssh root@72.60.89.5` (password: `3f-O78sAL@e/?cDw,Q.D`)

**Deploy Workflow:**

1. **Build local + push Docker Hub:**
   ```bash
   cd Empatia_Backend_Clean
   docker compose build
   docker tag empatia-backend:latest yourusername/empatia-backend:latest
   docker push yourusername/empatia-backend:latest
   ```

2. **Deploy na VPS:**
   ```bash
   ssh root@72.60.89.5
   cd /root/empatia
   docker compose pull
   docker compose up -d
   docker compose logs -f empatia-agent
   ```

**docker-compose.yml:**
```yaml
services:
  empatia-agent:
    image: yourusername/empatia-backend:latest
    env_file: .env
    volumes:
      - ./vertex-key.json:/app/vertex-key.json:ro
    networks:
      - empatia-network
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_USER: empatia_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: empatia_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - empatia-network
    restart: unless-stopped
```

**Ficheiros Necessários na VPS:**
- `.env` (DATABASE_URL, LIVEKIT_*, GOOGLE_*)
- `vertex-key.json` (Service Account Google)

---

### Verificação Pós-Deploy

```bash
# 1. Check logs do agente
docker compose logs -f empatia-agent | grep -i "error\|warning\|conectado"

# 2. Verificar BD (pgvector extension)
docker exec -it <postgres_container> psql -U empatia_admin -d empatia_db
\dx  -- Listar extensões (deve ter 'vector')
\dt  -- Listar tabelas (users, user_memories, session_summaries)
\di  -- Listar índices (pgvector IVFFlat)

# 3. Teste de conversa
# Frontend → Iniciar chamada → Verificar logs:
# - "Conectado à Base de Dados com sucesso!"
# - "Sessão iniciada. A EmpatIA está pronta."
# - "A enviar saudação inicial..."

# 4. Pós-conversa: verificar sumarização
# Após desligar → Logs devem mostrar:
# - "SUMARIZAÇÃO: Verificar pré-condições. Items: X"
# - "Gerados Y embeddings para memórias individuais."
# - "Inseridas Z memórias em user_memories."
# - "Perfil atualizado com novos factos e correções."

# 5. Verificar N8N triggers
# N8N → Executions → Deve haver nova execution após conversa
```

---

## Performance e Otimizações

### 1. Latência de Voz

**Objetivo:** <500ms end-to-end

**Otimizações:**
- ✅ Região europe-west1 (Google + LiveKit)
- ✅ Native audio (sem STT/TTS intermediário)
- ✅ NON_BLOCKING tool behavior
- ✅ Monkey patches (evita stuttering)
- ✅ VAD tuned para idosos (1000ms silence_duration)

**Medições Típicas:**
- User fala → Gemini deteta fim de fala: **1000ms** (VAD)
- Gemini processa + gera resposta: **200-400ms**
- Resposta chega ao user: **<100ms** (WebRTC)
- **Total:** ~1.3-1.5s (aceitável para conversação natural)

---

### 2. Queries de BD

**pgvector IVFFlat Index:**
```sql
CREATE INDEX idx_user_memories_embedding ON user_memories
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Performance:**
- **Sequential Scan** (sem índice): O(n) - 10ms para 1k rows, 1s para 100k rows
- **IVFFlat Index** (com índice): O(log n) - ~5-10ms mesmo com 1M+ rows

**Trade-off:**
- Índice só é eficiente com **>10k rows**
- Com poucos dados, PostgreSQL usa sequential scan de qualquer forma
- `lists=100` = 100 clusters (ajustar quando tiver >100k memories)

---

### 3. Embeddings

**Batch vs Individual:**

| Método | Chamadas API | Latência Total (10 memórias) |
|--------|--------------|------------------------------|
| Individual | 10 chamadas | 10 × 200ms = **2000ms** |
| Batch | 1 chamada | **400ms** |

**Implementação:**
```python
# Batch (preferido)
emb_response = client.models.embed_content(
    model="text-multilingual-embedding-002",
    contents=["memória 1", "memória 2", ..., "memória 10"]
)

# Fallback individual (se batch falhar)
for mem in memories:
    single_resp = client.models.embed_content(...)
```

---

### 4. Client Caching

**Problema:** `genai.Client()` cria SSL handshake + auth token (~500-1000ms)

**Solução:**
```python
_genai_client = None  # Module-level cache

def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(...)
    return _genai_client
```

**Impacto:**
- Primeira chamada: 800ms
- Chamadas seguintes: <50ms
- **5 chamadas em 1min:** De 4000ms → 1000ms (75% redução)

---

## Segurança e GDPR

### 1. Dados Pessoais

**Categorias:**
- Perfil (nome, idade, preferências)
- Memórias de conversas (saúde, família, emoções)
- Transcrições (temporárias, apenas em memória durante análise)

**Armazenamento:**
- PostgreSQL na **Europa** (VPS Germany)
- Google Vertex AI **europe-west1**
- LiveKit Cloud **Germany 2**

**Retenção:**
- `users`: Permanente (enquanto conta ativa)
- `user_memories`: Permanente (até pedido de eliminação)
- `session_summaries`: 1 ano (depois arquivado)
- Transcrições: **NÃO guardadas** (apenas processadas em memória)

---

### 2. Direitos do Utilizador

**Acesso:**
- Dashboard: ver perfil e histórico de sessões
- API endpoint: `/api/user/data` (export completo JSON)

**Retificação:**
- Dashboard: editar perfil manualmente
- Durante conversa: correções detetadas automaticamente

**Eliminação:**
- Soft delete: `users.deleted_at`
- Cascade delete: `ON DELETE CASCADE` em foreign keys
- Hard delete após 30 dias (compliance)

**Portabilidade:**
- Export JSON com `profile`, `user_memories`, `session_summaries`

---

### 3. Autenticação

**NextAuth.js (Frontend):**
- Email + password (bcrypt hash)
- Session JWT (httpOnly cookie)
- CSRF protection

**LiveKit Tokens (Backend):**
- Short-lived (1h expiry)
- Assinados com LIVEKIT_API_SECRET
- Inclui user_identity (UUID)

**Database Access:**
- Backend: asyncpg com SSL
- Frontend: Prisma ORM com prepared statements (anti SQL injection)

---

## Troubleshooting

### Problema: "Agente não responde após frases longas"

**Causa:**
- VAD `silence_duration_ms` muito curto
- `recall_memories` chamada excessivamente (latência API)
- Client não cached (re-criar SSL a cada chamada)

**Solução:**
```python
# agent.py
silence_duration_ms=1000  # Era 500ms
end_of_speech_sensitivity=EndSensitivity.END_SENSITIVITY_LOW

# Timeout em recall_memories
await asyncio.wait_for(semantic_memory_search(...), timeout=5.0)

# Client cached
client = _get_genai_client()  # Não criar novo a cada chamada
```

---

### Problema: "column 'content' does not exist"

**Causa:**
- Tabela `user_memories` já existia de versão anterior
- `CREATE TABLE IF NOT EXISTS` não altera schema existente

**Solução:**
```sql
-- Na VPS:
docker exec -it <postgres_container> psql -U empatia_admin -d empatia_db

-- Ver schema atual:
\d user_memories

-- Se estiver errado, apagar e recriar:
DROP TABLE IF EXISTS user_memories CASCADE;

-- Reiniciar agente (vai criar tabela correta):
docker compose restart empatia-agent
```

---

### Problema: "Semantic search error: timeout"

**Causa:**
- Embedding API demorou >4s
- BD connection pool esgotado

**Diagnóstico:**
```bash
# Logs do agente
docker compose logs -f empatia-agent | grep -i "semantic\|timeout"

# Ver connections ativas na BD
docker exec -it <postgres_container> psql -U empatia_admin -d empatia_db
SELECT * FROM pg_stat_activity WHERE datname = 'empatia_db';
```

**Solução:**
- Aumentar timeout: `timeout=10.0` (se API Google estiver lenta)
- Connection pool: verificar `db_pool.acquire()` está a fazer release

---

### Problema: "N8N não recebe triggers"

**Causa:**
- Trigger SQL não configurado
- N8N webhook URL mudou
- Firewall bloqueando POST

**Verificação:**
```sql
-- Ver triggers na tabela
SELECT * FROM pg_trigger WHERE tgrelid = 'session_summaries'::regclass;

-- Testar INSERT manual
INSERT INTO session_summaries (user_id, session_summary, emotional_state, new_facts)
VALUES ('214dfbc0-7570-44ef-9968-10ddc67bfb45', 'Teste', 'feliz', '{}');

-- N8N → Executions → Deve aparecer nova execution
```

---

## Changelog

| Versão | Data | Mudanças |
|--------|------|----------|
| **2.1** | 2026-02-16 | ✅ **Session Resumption:** Configurado `SessionResumptionConfig(transparent=True)` para permitir reconexão sem perda de contexto<br>✅ **Context Window Compression:** Ativado `ContextWindowCompressionConfig(enabled=True)` para conversas longas<br>📝 Imports atualizados com novos tipos do Gen AI SDK<br>📄 Documentação completa em `SESSION_RESUMPTION_NOTES.md` |
| **2.0** | 2026-02-13 | 🔄 **Refactoring de memórias:** Movido escrita de memórias para pós-conversa<br>✅ Adicionado `recall_memories` tool (read-only)<br>✅ Removido `manage_memory` tool (eliminado stuttering)<br>✅ Batch embedding generation<br>✅ Dual memory: `user_memories` (RAG) + `users.profile` (estruturado)<br>✅ Deteção automática de contradições |
| **1.2** | 2026-02-13 | ⚙️ VAD ajustado: `silence_duration_ms=800ms`, `end_sensitivity=LOW`<br>⏱️ Timeouts adicionados: `recall_memories` (5s), embeddings (4s)<br>🗄️ Client cached (`_get_genai_client()`) para evitar re-criar SSL/auth<br>📝 Logging melhorado em tools |

---

## Roadmap Futuro

### Curto Prazo (1-2 meses)
- [ ] Dashboard para familiares (view-only de session_summaries)
- [ ] Alertas de inatividade (>7 dias sem conversa)
- [ ] Export GDPR (botão "Download my data")
- [ ] Testes de carga (100 users simultâneos)

### Médio Prazo (3-6 meses)
- [ ] Multi-tenancy (organizações/lares)
- [ ] Voz personalizada (fine-tune Gemini por utilizador)
- [ ] Integração com smartwatches (Apple Watch, Garmin)
- [ ] Modo offline (conversas locais quando sem net)

### Longo Prazo (6-12 meses)
- [ ] Multimodal (análise de fotos enviadas)
- [ ] Video calls (ativar câmara se utilizador quiser)
- [ ] Detecção proativa de emergências (análise de padrões de saúde)
- [ ] Marketplace de "personalities" (diferentes tons/estilos de conversa)

---

## Contactos e Suporte

**Equipa:** Boommakers
**Projeto:** EmpatIA
**Versão da Arquitetura:** 2.0 (Pós-refactoring Fev 2026)

**Repositórios:**
- Frontend: `empatia-frontend/`
- Backend: `Empatia_Backend_Clean/`

**VPS Produção:**
- IP: 72.60.89.5
- SSH: `root@72.60.89.5`
- Região: Germany

**LiveKit:**
- URL: wss://empatia-dvfazc45.livekit.cloud
- Região: Germany 2

---

**Fim do Documento**
