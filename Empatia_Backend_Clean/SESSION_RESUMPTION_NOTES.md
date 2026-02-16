# Session Resumption & Context Compression - Notas de Implementação

**Data:** 2026-02-16
**Versão:** 2.1

---

## Funcionalidades Implementadas

### 1. Session Resumption (Retomar Sessões) ✅

**O que faz:**
- Permite que utilizadores com internet instável reconectem sem perder o contexto da conversa
- O servidor Gemini envia checkpoints periódicos da sessão
- Em caso de desconexão, a sessão pode ser retomada usando o último checkpoint

**Configuração adicionada (agent.py:275-279):**
```python
session_resumption=SessionResumptionConfig(
    transparent=True  # Reconexão transparente com buffer de mensagens
)
```

**Como funciona:**

1. **Durante a conversa:**
   - O servidor Gemini envia mensagens `SessionResumptionUpdate` periodicamente
   - Cada update contém um `new_handle` (token de sessão) e `resumable=True/False`
   - O `last_consumed_client_message_index` indica qual foi a última mensagem do cliente processada

2. **Em caso de desconexão:**
   - O cliente pode guardar o último `new_handle` recebido
   - Ao reconectar, envia esse handle ao criar nova sessão
   - O servidor restaura o contexto até ao ponto do checkpoint

3. **Transparent mode (`transparent=True`):**
   - Permite buffer de mensagens enviadas após o último checkpoint
   - Evita perder áudio/vídeo parcial durante reconexão temporária
   - Útil para desconexões curtas (< 30s)

**Estado atual:**
- ✅ Configuração ativada no servidor
- ⚠️ **TODO:** Implementar handling de `SessionResumptionUpdate` messages
- ⚠️ **TODO:** Guardar handles em memória/BD
- ⚠️ **TODO:** Lógica de reconexão no frontend

**Benefícios para EmpatIA:**
- Idosos com internet móvel/instável não perdem contexto
- Menos frustração ao ter que repetir informação
- Experiência mais robusta

---

### 2. Context Window Compression (Comprimir Contexto) ✅

**O que faz:**
- Comprime automaticamente o context window quando se aproxima do limite
- Mantém informação mais relevante e descarta detalhes menos importantes
- Permite conversas mais longas sem perder contexto crítico

**Configuração adicionada (agent.py:282-286):**
```python
context_window_compression=ContextWindowCompressionConfig(
    enabled=True  # Compressão automática quando necessário
)
```

**Como funciona:**

1. **Monitorização automática:**
   - O servidor Gemini monitoriza o uso do context window
   - Quando se aproxima do limite (ex: 80% do max), ativa compressão

2. **Estratégia de compressão:**
   - Mantém: system instruction, memórias recentes, turn atual
   - Resume/comprime: conversações antigas, repetições, silêncios longos
   - Descarta: informação redundante ou de baixo valor

3. **Transparente para o utilizador:**
   - Compressão acontece em background
   - O utilizador não percebe (mantém experiência natural)
   - Modelo continua a ter acesso a informação relevante

**Benefícios para EmpatIA:**
- Conversas de 10-15 minutos sem esgotar context window
- Especialmente útil com `TURN_INCLUDES_ALL_INPUT` (que inclui silêncios)
- Idosos que falam devagar/pausam muito não esgotam contexto

**Custos:**
- ⚠️ Pode comprimir informação que seria útil (raro)
- ⚠️ Adiciona latência mínima (<100ms) quando comprime
- ✅ Geralmente imperceptível para o utilizador

---

## Limitações Conhecidas

### Session Resumption

**Não funciona em:**
- ❌ Meio de function call (o modelo está a executar uma tool)
- ❌ Meio de geração de áudio (o modelo está a falar)
- ❌ Sessões sem checkpoints recentes (>2min sem update)

**Nesses casos:**
- O servidor envia `SessionResumptionUpdate` com `resumable=false`
- Reconexão inicia nova sessão (perde contexto)

**Duração dos handles:**
- Handles expiram após **10 minutos** de inatividade
- Após expiração, reconexão inicia nova sessão

### Context Window Compression

**Limitações:**
- Compressão é **lossy** (perde alguma informação)
- Prioriza informação recente sobre antiga
- Factos importantes mencionados há muito tempo podem ser comprimidos

**Mitigação no EmpatIA:**
- ✅ Factos importantes guardados no `users.profile` (não comprimido)
- ✅ Memórias episódicas em `user_memories` (busca via RAG)
- ✅ Compressão afeta apenas histórico de conversa em memória

---

## Testing & Validation

### Testar Session Resumption

**Cenário 1: Desconexão curta (WiFi instável)**
```
1. Iniciar conversa normal (2-3 min)
2. Desligar WiFi do telemóvel por 5-10s
3. Religar WiFi
4. Verificar se contexto foi mantido
```

**Logs esperados:**
```
INFO: SessionResumptionUpdate received: handle=xxx, resumable=true
INFO: Client reconnected using handle=xxx
INFO: Session resumed successfully
```

**Cenário 2: Desconexão longa (>30s)**
```
1. Iniciar conversa normal
2. Fechar app completamente
3. Aguardar 1-2 minutos
4. Reabrir app e reconectar
5. Verificar se inicia nova sessão (contexto perdido)
```

### Testar Context Window Compression

**Cenário 1: Conversa muito longa**
```
1. Conversa de 15-20 minutos
2. Com muitas pausas/silêncios (idoso pensativo)
3. Verificar se modelo mantém contexto de início
```

**Logs esperados:**
```
INFO: Context window at 82%, initiating compression
INFO: Compressed 15 turns to 8 turns (47% reduction)
INFO: Context window at 65% after compression
```

**Verificação:**
- Perguntar ao modelo sobre algo mencionado há 10+ minutos
- Deve lembrar factos importantes (comprimidos mas preservados)
- Pode esquecer detalhes irrelevantes (ex: pausas, "hmmm")

---

## Próximos Passos (TODO)

### Curto Prazo (1-2 semanas)

- [ ] **Implementar handler de `SessionResumptionUpdate`**
  - Listener para mensagens do servidor
  - Guardar `new_handle` em memória (cache local)
  - Logging detalhado para debug

- [ ] **Adicionar lógica de reconexão**
  - Frontend: detectar desconexão → guardar handle → reconectar
  - Backend: aceitar handle na reconexão → restaurar sessão
  - Fallback: se resumption falhar, iniciar nova sessão

- [ ] **Persistir handles (opcional)**
  - Guardar em Redis/BD se queremos sobreviver a restart do backend
  - TTL de 10 minutos (matching com expiração do servidor)

### Médio Prazo (1-2 meses)

- [ ] **Telemetria e Monitorização**
  - Métrica: % de sessões retomadas com sucesso
  - Métrica: Tempo médio até expiração de handle
  - Métrica: Frequência de compressão de contexto

- [ ] **UX de Reconexão**
  - Mensagem ao utilizador: "A reconectar..." (transparente)
  - Se falhar: "Vamos começar de novo, como está?"
  - Loading state durante reconnection

- [ ] **Ajustes de Compressão**
  - Monitorizar se compressão está a descartar info importante
  - Ajustar threshold (80% vs 70% vs 90%)
  - A/B test com/sem compressão

---

## Referências

- **Gemini Live API Reference:** Páginas 18-19 (Session Resumption), Página 19 (Context Compression)
- **Google Cloud Docs:** https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live
- **Código:** `agent.py` linhas 275-286

---

## Changelog

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-02-16 | 2.1 | Adicionado Session Resumption + Context Window Compression |
| 2026-02-13 | 2.0 | Refactoring de memórias (read during, write after) |
| 2026-02-13 | 1.2 | Ajustes de VAD (silence_duration_ms, end_sensitivity) |

---

**Fim do Documento**
