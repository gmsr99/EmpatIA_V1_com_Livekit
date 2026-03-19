-- =============================================================
-- EmpatIA — Schema Canónico
-- Base de dados: empatia_db (PostgreSQL 16 + pgvector)
-- Aplicar uma vez num ambiente novo: psql -U empatia_admin -d empatia_db -f schema.sql
-- =============================================================

-- Extensão de vetores (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- -------------------------------------------------------------
-- UTILIZADORES
-- Tabela principal de contas. A password é um hash bcrypt.
-- O perfil é um JSONB estruturado com categorias:
--   personal | health | family | preferences | topics
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT,
    email       TEXT    UNIQUE,
    password    TEXT,   -- bcrypt hash
    image       TEXT,
    profile     JSONB   DEFAULT '{}'
);

-- -------------------------------------------------------------
-- MEMÓRIAS EPISÓDICAS
-- Cada linha é um facto isolado extraído pós-sessão pelo Gemini.
-- O embedding (768d) permite busca semântica via pgvector.
-- memory_type: 'fact' | 'emotion' | 'story' | 'prayer' | 'routine' | 'health_alert'
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_memories (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL,
    embedding   vector(768),
    memory_type TEXT        DEFAULT 'fact',
    created_at  TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_id
    ON user_memories(user_id);

CREATE INDEX IF NOT EXISTS idx_user_memories_created_at
    ON user_memories(created_at DESC);

-- Índice vetorial para busca semântica (IVFFlat — migrar para HNSW quando > 5k linhas)
CREATE INDEX IF NOT EXISTS idx_user_memories_embedding
    ON user_memories USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- -------------------------------------------------------------
-- RESUMOS DE SESSÃO
-- Gerados pelo Gemini 2.0 Flash após cada conversa.
-- Usados para: relatórios N8N, estado emocional inicial, dashboard de cuidadores.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_summaries (
    id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID    REFERENCES users(id) ON DELETE CASCADE,
    session_summary TEXT,
    emotional_state TEXT,
    new_facts       JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_user_id
    ON session_summaries(user_id);

CREATE INDEX IF NOT EXISTS idx_session_summaries_created_at
    ON session_summaries(created_at DESC);

-- -------------------------------------------------------------
-- SESSÕES DE SKILLS
-- Registo de cada atividade estruturada (reza, história, livro, música).
-- skill_type: 'prayer' | 'story' | 'book' | 'music'
-- metadata: JSON livre por skill (ex: {"chapter": 2, "prayer": "pai_nosso"})
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_sessions (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_type  TEXT        NOT NULL,
    skill_name  TEXT,
    content     TEXT,
    metadata    JSONB       DEFAULT '{}',
    created_at  TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_sessions_user_id
    ON skill_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_skill_sessions_type
    ON skill_sessions(user_id, skill_type);
