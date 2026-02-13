#!/usr/bin/env python3
"""
Script para testar a dimensão dos embeddings do modelo gemini-embedding-001
NOTA: Execute este script a partir da pasta Empatia_Backend_Clean onde está o .env
"""
import os
import asyncio
from dotenv import load_dotenv
from google import genai

async def test_embedding_dimension():
    print("=== TESTE DE DIMENSÃO DE EMBEDDINGS ===\n")

    # Carregar variáveis de ambiente do .env
    load_dotenv()

    # Verificar se as credenciais estão configuradas
    google_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    google_project = os.getenv("GOOGLE_CLOUD_PROJECT")

    print(f"📁 GOOGLE_APPLICATION_CREDENTIALS: {google_creds}")
    print(f"🔑 GOOGLE_CLOUD_PROJECT: {google_project}\n")

    if not google_creds or not google_project:
        print("❌ ERRO: Variáveis de ambiente não configuradas!")
        print("   Certifique-se de que o ficheiro .env contém:")
        print("   - GOOGLE_APPLICATION_CREDENTIALS=./vertex-key.json")
        print("   - GOOGLE_CLOUD_PROJECT=empatia-480916")
        return

    # Configurar cliente
    client = genai.Client(
        vertexai=True,
        project=google_project,
        location="europe-west1"
    )

    # Texto de teste
    test_text = "Olá, isto é um teste para verificar a dimensão do embedding."
    print(f"Texto de teste: {test_text}\n")

    # Testar gemini-embedding-001
    print("🧪 Testando modelo: gemini-embedding-001")
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=test_text
        )
        embedding = response.embeddings[0].values
        print(f"✅ Dimensão: {len(embedding)}")
        print(f"   Primeiros 5 valores: {embedding[:5]}\n")
    except Exception as e:
        print(f"❌ Erro: {e}\n")

    # Testar text-embedding-004 para comparação
    print("🧪 Testando modelo: text-embedding-004")
    try:
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=test_text
        )
        embedding = response.embeddings[0].values
        print(f"✅ Dimensão: {len(embedding)}")
        print(f"   Primeiros 5 valores: {embedding[:5]}\n")
    except Exception as e:
        print(f"❌ Erro: {e}\n")

    # Testar text-multilingual-embedding-002 (RECOMENDADO para PT)
    print("🧪 Testando modelo: text-multilingual-embedding-002 (ESCOLHIDO)")
    try:
        response = client.models.embed_content(
            model="text-multilingual-embedding-002",
            contents=test_text
        )
        embedding = response.embeddings[0].values
        print(f"✅ Dimensão: {len(embedding)}")
        print(f"   Primeiros 5 valores: {embedding[:5]}")
        print(f"   ⭐ Este modelo é otimizado para português!\n")
    except Exception as e:
        print(f"❌ Erro: {e}\n")

    print("\n=== CONCLUSÃO ===")
    print("✅ Se ambos os modelos funcionarem, escolher um e ajustar agent.py")
    print("⚠️  Se gemini-embedding-001 falhar, voltar para text-embedding-004")
    print("📝 Ajustar vector(DIMENSÃO) na tabela user_memories conforme necessário")

if __name__ == "__main__":
    # Verificar se o .env existe
    if not os.path.exists(".env"):
        print("❌ ERRO: Ficheiro .env não encontrado!")
        print("   Execute este script na pasta Empatia_Backend_Clean")
        exit(1)

    asyncio.run(test_embedding_dimension())
