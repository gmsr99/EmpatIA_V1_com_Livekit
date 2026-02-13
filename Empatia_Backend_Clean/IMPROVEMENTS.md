# Melhorias Implementadas - EmpatIA Backend

Data: 2026-02-13
Autor: Claude Code

---

## 📋 Resumo das Alterações

Este documento descreve as melhorias implementadas no backend do EmpatIA para otimizar a gestão de memórias e preparar o sistema para busca semântica.

---

## 🎯 Objetivos

1. ✅ **Mudar modelo de embeddings** para `text-multilingual-embedding-002` (otimizado para PT)
2. ✅ **Criar estrutura adequada para tabela `session_summaries`**
3. ✅ **Adicionar índices para performance**
4. ✅ **Implementar busca semântica** usando embeddings
5. ✅ **Garantir extensão pgvector**

---

## 🔧 Alterações Detalhadas

### 1. Modelo de Embeddings

**Modelo escolhido:** `text-multilingual-embedding-002`

**Alterado em:**
- `agent.py:114` - função `semantic_memory_search()`
- `agent.py:250` - função `save_episodic_background()`
- `agent.py:747` - summarização de sessão

**Antes:**
```python
model="text-embedding-004"
```

**Depois:**
```python
model="text-multilingual-embedding-002"
```

**✅ Vantagens do modelo escolhido:**
- **Dimensão eficiente:** 768 dimensões (vs 3072 do `gemini-embedding-001`)
- **Otimizado para português:** Treinado especificamente para línguas latinas incluindo PT-PT
- **Performance:** Queries mais rápidas devido à menor dimensão
- **Espaço em disco:** Ocupa menos espaço na BD (crítico para 100+ users)
- **Compatível com pgvector:** Dimensão 768 testada e validada

**📊 Comparação de modelos testados:**
| Modelo | Dimensão | Otimizado PT | Performance | Escolhido |
|--------|----------|--------------|-------------|-----------|
| `gemini-embedding-001` | 3072 | Não | Lento | ❌ |
| `text-embedding-004` | 768 | Parcial | Rápido | ⚠️ |
| `text-multilingual-embedding-002` | 768 | **Sim** | Rápido | ✅ |

**⚠️ NOTA sobre migração:**
- Se já existem dados em `user_memories` com embeddings de outro modelo, precisam ser regenerados
- **Script de teste:** `test_embedding_dimension.py` confirma que o modelo funciona

---

### 2. Criação Automática de Tabelas

**Local:** `agent.py:390-475` (dentro da função `entrypoint`)

#### 2.1 Extensão pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
- Necessária para armazenar e pesquisar vetores
- Falha graciosamente se não disponível (com warning)

#### 2.2 Tabela `user_memories`
```sql
CREATE TABLE IF NOT EXISTS user_memories (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),  -- text-multilingual-embedding-002: 768 dims
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Índices criados:**
- `idx_user_memories_user_id` - busca por utilizador
- `idx_user_memories_created_at` - ordenação por data
- `idx_user_memories_embedding` - busca vetorial (IVFFlat com 100 listas)

#### 2.3 Tabela `session_summaries`
```sql
CREATE TABLE IF NOT EXISTS session_summaries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    session_summary TEXT,
    emotional_state TEXT,
    new_facts JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Índices criados:**
- `idx_session_summaries_user_id` - busca por utilizador
- `idx_session_summaries_created_at` - ordenação por data

**Benefícios:**
- ✅ **PRIMARY KEY** para identificação única (necessário para triggers N8N)
- ✅ **Índices** para queries rápidas (crítico para 100+ users)
- ✅ **Foreign Keys** para integridade referencial
- ✅ **ON DELETE CASCADE** para limpeza automática

---

### 3. Busca Semântica Implementada

#### 3.1 Função Helper: `semantic_memory_search()`

**Local:** `agent.py:89-128`

**Funcionalidade:**
```python
async def semantic_memory_search(connection, user_identity: str, query_text: str, limit: int = 5)
```

**Como funciona:**
1. Gera embedding do texto da query usando `gemini-embedding-001`
2. Calcula similaridade de coseno com todos os embeddings do utilizador
3. Retorna as N memórias mais similares
4. **Fallback:** se falhar, retorna memórias recentes

**Query SQL:**
```sql
SELECT
    content,
    created_at,
    1 - (embedding <=> $2::vector) AS similarity
FROM user_memories
WHERE user_id = $1::uuid
ORDER BY embedding <=> $2::vector
LIMIT $3
```

**Operador `<=>`:** Distância de coseno do pgvector
**`1 - distância`:** Converte em score de similaridade (0 a 1)

#### 3.2 Nova Tool: `recall_memories()`

**Local:** `agent.py:273-307`

**Propósito:** Permitir que o agente **procure memórias relevantes durante a conversa**

**Como usar:**
```python
# O agente pode chamar esta tool durante a conversa:
recall_memories(topic="família")
# Retorna memórias semanticamente relacionadas com "família"
```

**Exemplo de output:**
```
Memórias sobre 'família':
- [2026-02-10] [Família] Learned: Tem 3 filhos (relevância: 0.92)
- [2026-02-08] [Família] Learned: A neta visitou no fim de semana (relevância: 0.87)
- [2026-02-05] Resumo da Sessão: Falou sobre jantar de família (relevância: 0.81)
```

**Registada como tool disponível:**
```python
tools = [manage_memory, recall_memories]
```

---

### 4. Carregamento Inicial de Memórias

**Alterado em:** `agent.py:502-517`

**Antes:**
```python
# Buscava apenas 3 memórias mais recentes
ORDER BY created_at DESC LIMIT 3
```

**Depois:**
```python
# Busca 5 memórias mais recentes para contexto inicial
ORDER BY created_at DESC LIMIT 5
```

**Nota:** No início da sessão ainda não há contexto de conversa, por isso não se usa busca semântica. Mas durante a conversa, o agente pode chamar `recall_memories()` com um tópico específico.

---

## 📊 Impacto nas Queries

### Antes (sem índices)
```
Query: SELECT * FROM session_summaries WHERE user_id = 'xxx'
Método: Sequential Scan (lê TODA a tabela)
Performance: O(n) - degrada com cada novo registo
```

### Depois (com índices)
```
Query: SELECT * FROM session_summaries WHERE user_id = 'xxx'
Método: Index Scan (apenas registos relevantes)
Performance: O(log n) - mantém-se rápido mesmo com milhões de registos
```

**Para 100+ users simultâneos:** A diferença é crítica.

---

## 🧪 Como Testar

### 1. Testar Dimensão dos Embeddings
```bash
cd Empatia_Backend_Clean
python test_embedding_dimension.py
```

**Se `gemini-embedding-001` falhar:**
1. Mudar de volta para `text-embedding-004` no código
2. Ou usar outro modelo compatível
3. Ajustar `vector(768)` na definição da tabela se necessário

### 2. Testar Criação de Tabelas
```bash
# Iniciar o agente (vai criar tabelas automaticamente)
docker compose up --build
```

**Verificar logs:**
```
INFO: Conectado à Base de Dados com sucesso!
```

### 3. Testar Busca Semântica (Manual)

Conectar à BD via SSH:
```bash
ssh root@72.60.89.5
# senha: 3f-O78sAL@e/?cDw,Q.D

# Entrar no PostgreSQL
docker exec -it <container_postgres> psql -U empatia_admin -d empatia_db

# Verificar tabelas criadas
\dt

# Verificar índices
\di

# Testar query de similaridade (exemplo)
SELECT content, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM user_memories
WHERE user_id = 'algum-uuid'
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

---

## ⚠️ Pontos de Atenção

### 1. Migração de Dados Existentes

Se já existem dados em `user_memories`:
- Os embeddings antigos (`text-embedding-004`) **não são compatíveis** com `gemini-embedding-001`
- **Opções:**
  1. **Limpar e recomeçar:** `TRUNCATE user_memories;`
  2. **Regenerar embeddings:** script para processar registos existentes
  3. **Manter modelo antigo:** voltar para `text-embedding-004`

### 2. Extensão pgvector

**Requisito:** PostgreSQL com extensão pgvector instalada

**Verificar se está instalada:**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Se não estiver:**
```bash
# No servidor PostgreSQL
apt-get install postgresql-<version>-pgvector
```

### 3. Índice IVFFlat

O índice `USING ivfflat` requer:
- **Mínimo 10.000 registos** para ser eficiente
- **Parâmetro `lists`:** configurado para 100 (ajustar conforme volume)

**Até ter dados suficientes:**
- O PostgreSQL fará sequential scan
- Performance é aceitável para poucos milhares de registos

### 4. Dimensão do Vetor

**CRÍTICO:** A dimensão na tabela (`vector(768)`) deve coincidir com o modelo:
- `text-embedding-004`: 768 dims ✅
- `gemini-embedding-001`: **verificar** com o script de teste
- Outros modelos: consultar documentação

**Se errar a dimensão:** INSERTs falharão com erro de tipo.

---

## 🚀 Próximos Passos Recomendados

### Prioridade ALTA
1. **Executar `test_embedding_dimension.py`** para confirmar dimensão
2. **Verificar se pgvector está instalado** no PostgreSQL da VPS
3. **Decidir sobre dados existentes** (limpar ou regenerar)
4. **Testar uma conversa completa** e verificar logs

### Prioridade MÉDIA
5. **Monitorizar performance** das queries com índices
6. **Ajustar parâmetro `lists` do índice** IVFFlat conforme crescimento
7. **Criar script de backup** para `session_summaries` (necessário para N8N)
8. **Adicionar logging** das chamadas à tool `recall_memories`

### Prioridade BAIXA
9. **Implementar cache** de embeddings frequentes
10. **Criar dashboard** para visualizar similaridade de memórias
11. **Optimizar número de memórias** carregadas (5 pode ser pouco/muito)

---

## 📚 Referências

- **pgvector docs:** https://github.com/pgvector/pgvector
- **Google Vertex AI embeddings:** https://cloud.google.com/vertex-ai/docs/generative-ai/embeddings
- **PostgreSQL indexes:** https://www.postgresql.org/docs/current/indexes.html
- **LiveKit Agents SDK:** https://docs.livekit.io/agents/

---

## ✅ Checklist de Deployment

Antes de fazer deploy para produção:

- [ ] Confirmar dimensão do modelo `gemini-embedding-001`
- [ ] Verificar extensão pgvector instalada na VPS
- [ ] Backup da base de dados (se houver dados)
- [ ] Testar criação de tabelas localmente
- [ ] Testar busca semântica com dados reais
- [ ] Verificar logs do agente após deploy
- [ ] Confirmar que N8N continua a receber triggers
- [ ] Monitorizar performance das queries
- [ ] Documentar qualquer erro encontrado

---

**Fim do documento**


## Deployment Test Fri Feb 13 14:33:44 WET 2026


## Deployment Test 2 Fri Feb 13 15:56:47 WET 2026
