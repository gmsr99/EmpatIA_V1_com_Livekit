#!/usr/bin/env python3
"""
Script para testar a dimensão dos embeddings do modelo gemini-embedding-001
"""
import os
import asyncio
from google import genai

async def test_embedding_dimension():
    print("=== TESTE DE DIMENSÃO DE EMBEDDINGS ===\n")

    # Configurar cliente
    client = genai.Client(
        vertexai=True,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
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

    print("=== CONCLUSÃO ===")
    print("Se gemini-embedding-001 não funcionar, usar text-embedding-004 (768 dims)")
    print("Ajustar o código do agent.py conforme necessário.")

if __name__ == "__main__":
    asyncio.run(test_embedding_dimension())
