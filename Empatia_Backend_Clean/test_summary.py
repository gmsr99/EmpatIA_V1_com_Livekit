import os
import asyncio
import asyncpg
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Carregar variáveis de ambiente
load_dotenv()

async def test_summary_and_save():
    print("--- INICIANDO TESTE COMPLETO (IA + DATABASE) ---")
    
    # 1. Obter ID de Utilizador Real da Base de Dados
    try:
        conn = await asyncpg.connect(
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            database=os.getenv("POSTGRES_DB"),
            host=os.getenv("POSTGRES_HOST"),
            port=5432
        )
        print("✅ Conexão à Base de Dados estabelecida.")
        
        row = await conn.fetchrow("SELECT id, name FROM users LIMIT 1")
        if not row:
            print("❌ ERRO: Nenhum utilizador encontrado na tabela 'users'. Crie um utilizador primeiro.")
            await conn.close()
            return
            
        user_id = row['id']
        user_name = row['name'] or "Utilizador Teste"
        print(f"👉 A usar utilizador: {user_name} (ID: {user_id})")

    except Exception as e:
        print(f"❌ ERRO DB: {e}")
        return

    # 2. Simular Conversa
    mock_transcript = [
        f"EmpatIA: Olá {user_name}, como se sente hoje?",
        "Utilizador: Hoje sinto-me um pouco em baixo, sabes. O tempo está cinzento e doem-me os joelhos.",
        "EmpatIA: Lamento ouvir isso. A humidade costuma piorar as dores nas articulações. Já tomou o seu chá hoje?",
        "Utilizador: Sim, tomei o de camomila. Mas o que me preocupa é que o meu neto João vai emigrar para a França.",
        "EmpatIA: Compreendo que isso lhe custe. É natural sentir saudades antecipadas. Mas hoje em dia com as videochamadas é mais fácil manter o contacto.",
        "Utilizador: É verdade. Bem, vou tentar descansar um pouco agora."
    ]
    full_text = "\n".join(mock_transcript)
    print(f"\n--- TRANSCRIPT ---\n{full_text[:100]}... (truncado)\n------------------")

    # 3. Gerar Resumo com Gemini
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = "europe-west1"
    
    try:
        print("A solicitar resumo ao Gemini...", end=" ")
        if project:
            client = genai.Client(vertexai=True, project=project, location=location)
        else:
            client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

        prompt = f"""
            Analise a seguinte conversa entre a assistente "EmpatIA" e o utilizador {user_name}.
            Retorne APENAS um objeto JSON com o seguinte formato:
            {{
                "new_facts": {{ "personal": [], "health": [], "family": [], "preferences": [], "topics": [] }},
                "emotional_state": "estado de espírito",
                "session_summary": "resumo"
            }}
            CONVERSA:
            {full_text}
            """

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        data = json.loads(response.text)
        print("✅ Feito.")
        
    except Exception as e:
        print(f"\n❌ ERRO IA: {e}")
        await conn.close()
        return

    # 4. Gravar na Base de Dados
    print("A gravar na tabela 'session_summaries'...", end=" ")
    try:
        await conn.execute("""
            INSERT INTO session_summaries (user_id, session_summary, emotional_state, new_facts, created_at)
            VALUES ($1::uuid, $2, $3, $4::jsonb, NOW())
        """, user_id, data.get('session_summary'), data.get('emotional_state'), json.dumps(data.get('new_facts')))
        print("✅ GRAVADO COM SUCESSO!")
        print(f"DICA: Verifique a tabela 'session_summaries' para o user_id {user_id}")
        
    except Exception as e:
        print(f"\n❌ ERRO INSERT: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(test_summary_and_save())
