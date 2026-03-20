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

-- -------------------------------------------------------------
-- DASHBOARD DE CUIDADORES
-- user_type: 'patient' (default) | 'caregiver'
-- username: login para idosos (sem email) — criado pelo cuidador
-- caregiver_id: FK para o cuidador que criou este utente (NULL para cuidadores)
-- -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type    TEXT DEFAULT 'patient';
ALTER TABLE users ADD COLUMN IF NOT EXISTS username     TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS caregiver_id UUID REFERENCES users(id) ON DELETE SET NULL;
-- access_code is deprecated (replaced by caregiver_id direct FK)
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- -------------------------------------------------------------
-- PERFIL DE UTILIZADOR (IDOSO)
-- Preenchido pelo cuidador/familiar no dashboard.
-- Passado ao agente no início de cada sessão.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_profiles (
    id                  BIGSERIAL   PRIMARY KEY,
    user_id             UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name           TEXT,                   -- nome preferido / alcunha
    gender              TEXT,                   -- 'masculino' | 'feminino'
    age                 INTEGER,
    location            TEXT,                   -- localidade ou região
    profession_retired  TEXT,                   -- profissão antes da reforma
    medications         TEXT[]      DEFAULT '{}',
    interests           TEXT[]      DEFAULT '{}',
    family              TEXT[]      DEFAULT '{}',
    religious           TEXT,                   -- preferências religiosas/espirituais
    notes               TEXT,                   -- notas livres do cuidador para o agente
    updated_at          TIMESTAMP   DEFAULT NOW()
);

-- Migration: add gender column
ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS gender TEXT;

-- -------------------------------------------------------------
-- PERFIL DE CUIDADOR
-- Inclui campos de subscrição Stripe e limites de utentes.
-- subscription_tier: 'trial' | 'basic' | 'extended' | 'professional'
-- subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled'
-- patient_limit: 1 (trial/basic) | 2 (extended) | 5 (professional)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS caregiver_profiles (
    id                     BIGSERIAL   PRIMARY KEY,
    user_id                UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                   TEXT,       -- 'familiar' | 'profissional' | 'voluntário'
    organization           TEXT,       -- instituição/empresa (se profissional)
    phone                  TEXT,
    notes                  TEXT,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    subscription_tier      TEXT        DEFAULT 'trial',
    subscription_status    TEXT        DEFAULT 'active',
    trial_ends_at          TIMESTAMP,
    patient_limit          INTEGER     DEFAULT 1,
    updated_at             TIMESTAMP   DEFAULT NOW()
);

-- Migration: add Stripe columns to existing caregiver_profiles
ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT;
ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS subscription_tier      TEXT DEFAULT 'trial';
ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS subscription_status    TEXT DEFAULT 'active';
ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMP;
ALTER TABLE caregiver_profiles ADD COLUMN IF NOT EXISTS patient_limit          INTEGER DEFAULT 1;

-- Migration: add username and caregiver_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS username     TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS caregiver_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- caregiver_patients is deprecated (replaced by users.caregiver_id FK)
-- Kept for backward compat only — new code does NOT insert into this table
CREATE TABLE IF NOT EXISTS caregiver_patients (
    id           BIGSERIAL PRIMARY KEY,
    caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(caregiver_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_caregiver_patients_caregiver
    ON caregiver_patients(caregiver_id);

CREATE INDEX IF NOT EXISTS idx_caregiver_patients_patient
    ON caregiver_patients(patient_id);

-- -------------------------------------------------------------
-- ALERTAS DE SAÚDE
-- alert_type: 'keyword_high' | 'keyword_medium' | 'keyword_low'
--           | 'no_contact'   | 'mood_decline'
-- Keyword alerts: inseridos pelo agente pós-sessão
-- Behavioral alerts: calculados em tempo real no dashboard
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_alerts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type TEXT    NOT NULL,
    content    TEXT,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_user
    ON health_alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_health_alerts_unread
    ON health_alerts(user_id, is_read) WHERE NOT is_read;

-- -------------------------------------------------------------
-- UTILIZAÇÃO MENSAL
-- Regista os minutos de conversação por utilizador por mês.
-- year_month: 'YYYY-MM' (ex: '2026-03')
-- monthly_limit: 1800 minutos (30 horas) por defeito
-- Incrementado pelo frontend no fim de cada sessão.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_usage (
    patient_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year_month   TEXT    NOT NULL,  -- 'YYYY-MM'
    minutes_used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (patient_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_patient_usage_patient
    ON patient_usage(patient_id);
