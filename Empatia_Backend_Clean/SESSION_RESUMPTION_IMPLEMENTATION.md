# Session Resumption - Implementação Completa

**Data:** 2026-02-16
**Status:** ✅ Fase 1 Completa | ⏳ Fase 2 Pendente | ⏳ Fase 3 Pendente

---

## ✅ Fase 1: Handler de SessionResumptionUpdate (COMPLETO)

### O que foi implementado:

#### 1. **Cache Global de Handles**
```python
# agent.py (linha ~133)
_session_handles = {}  # Formato: {user_identity: {handle, resumable, timestamp, last_message_index}}
```

#### 2. **Monkey Patch para Interceptar Mensagens**
```python
# agent.py (linhas ~92-122)
_original_handle_response = realtime_api.RealtimeSession._handle_response

async def _patched_handle_response(self, resp: genai_types.LiveServerMessage):
    if hasattr(resp, 'session_resumption_update') and resp.session_resumption_update:
        # Guardar handle em _session_handles
        ...
```

**Como funciona:**
- Intercepta TODAS as mensagens do servidor Gemini
- Quando recebe `SessionResumptionUpdate`, extrai:
  - `new_handle` - Token de sessão
  - `resumable` - Se pode ser retomada
  - `last_consumed_client_message_index` - Última mensagem processada
- Guarda em `_session_handles` com timestamp

#### 3. **Helper Functions**
```python
# agent.py (linhas ~158-200)
def save_session_handle(user_identity, handle, resumable, last_message_index)
def get_session_handle(user_identity) -> dict | None  # Verifica expiração (10min)
def clear_session_handle(user_identity)
```

#### 4. **Integração no Entrypoint**

**Início da sessão (linha ~507):**
```python
# Verificar se existe handle anterior
previous_handle = get_session_handle(user_identity)
if previous_handle and previous_handle['resumable']:
    logger.info(f"[SessionResumption] Handle anterior encontrado")
    # TODO: Passar handle ao RealtimeModel
```

**Fim da sessão (linha ~943):**
```python
finally:
    clear_session_handle(user_identity)
    logger.info(f"[SessionResumption] Handle removido (sessão terminou)")
```

#### 5. **Contexto Global**
```python
# agent.py (linha ~130)
_current_user_identity = None  # Permite monkey patches acederem ao user_identity

# No entrypoint (linha ~508)
_current_user_identity = user_identity  # Definido após obter do LiveKit
```

---

## ⏳ Fase 2: Passar Handle ao RealtimeModel (PENDENTE)

### Problema:

O **LiveKit Agents SDK** atualmente **NÃO expõe API** para passar um session resumption handle ao criar o modelo.

### Solução Proposta:

#### Opção A: Patch no LiveKit Plugin (Mais invasivo)

```python
# Fazer patch do _create_session no livekit.plugins.google.realtime.realtime_api

_original_create_session = realtime_api.RealtimeSession._create_session

async def _patched_create_session(self, *args, **kwargs):
    # Verificar se há handle guardado
    global _current_user_identity
    handle_data = get_session_handle(_current_user_identity)

    if handle_data and handle_data['resumable']:
        # Adicionar handle ao setup message
        kwargs['session_resumption_handle'] = handle_data['handle']
        logger.info(f"[SessionResumption] A usar handle: {handle_data['handle'][:20]}...")

    return await _original_create_session(self, *args, **kwargs)
```

#### Opção B: Contribuir para o LiveKit SDK (Recomendado)

1. Fazer fork do `livekit-agents-python`
2. Adicionar parâmetro `session_resumption_handle` ao `RealtimeModel.__init__`
3. Passar handle no `BidiGenerateContentSetup` message
4. Submeter PR ao repo oficial

#### Opção C: Aguardar Suporte Oficial (Mais simples)

- Abrir issue no repo do LiveKit: https://github.com/livekit/agents
- Descrever use case (idosos com internet instável)
- Aguardar implementação oficial

---

## ⏳ Fase 3: Frontend - Reconexão Automática (PENDENTE)

### O que é necessário:

#### 1. **Detectar Desconexão**

```typescript
// empatia-frontend (LiveKit client)
room.on(RoomEvent.Disconnected, async (reason) => {
  console.log('[SessionResumption] Desconectado:', reason);

  // Guardar estado atual
  saveReconnectionState({
    userId: currentUser.id,
    roomName: room.name,
    disconnectReason: reason,
    timestamp: Date.now()
  });

  // Tentar reconectar em 2s
  setTimeout(() => attemptReconnect(), 2000);
});
```

#### 2. **Reconexão com Context**

```typescript
async function attemptReconnect() {
  const state = getReconnectionState();

  if (!state || Date.now() - state.timestamp > 600000) {
    // Expirou (>10min) ou não há estado
    console.log('[SessionResumption] Estado expirado, nova sessão');
    startNewSession();
    return;
  }

  // Reconectar à mesma room
  try {
    await room.connect(livekitUrl, token, {
      autoSubscribe: true
    });

    console.log('[SessionResumption] Reconectado com sucesso');
    showNotification('Reconectado!', 'success');

  } catch (error) {
    console.error('[SessionResumption] Falha ao reconectar:', error);
    showNotification('A iniciar nova conversa...', 'info');
    startNewSession();
  }
}
```

#### 3. **UX de Reconexão**

```tsx
// empatia-frontend/components/SessionStatus.tsx
{disconnected && reconnecting && (
  <div className="reconnection-banner">
    <Spinner />
    <span>A reconectar...</span>
    <ProgressBar value={reconnectionAttempt} max={3} />
  </div>
)}

{disconnected && !reconnecting && (
  <div className="new-session-banner">
    <Info />
    <span>Vamos começar de novo. Como está?</span>
  </div>
)}
```

---

## 📊 Estado Atual

| Componente | Status | Notas |
|------------|--------|-------|
| **Backend: Interceptar handles** | ✅ COMPLETO | Patch funcional, guarda handles em memória |
| **Backend: Cache em memória** | ✅ COMPLETO | TTL de 10min, verificação de expiração |
| **Backend: Logging** | ✅ COMPLETO | Logs detalhados de todos os eventos |
| **Backend: Passar handle ao modelo** | ⏳ PENDENTE | Requer patch adicional ou update do LiveKit SDK |
| **Frontend: Detectar desconexão** | ❌ NÃO INICIADO | - |
| **Frontend: Reconectar automaticamente** | ❌ NÃO INICIADO | - |
| **Frontend: UX de reconexão** | ❌ NÃO INICIADO | - |
| **Persistência: Redis/BD** | ❌ NÃO INICIADO | Atualmente só em memória (perde em restart) |

---

## 🧪 Testing

### Como testar o handler (Fase 1):

```bash
# 1. Build e deploy
cd Empatia_Backend_Clean
docker compose up --build -d

# 2. Iniciar conversa no frontend
# Aguardar 30s-1min de conversa

# 3. Verificar logs
docker compose logs -f empatia-agent | grep SessionResumption
```

**Logs esperados:**
```
INFO: [SessionResumption] Handle guardado: user=214dfbc0..., resumable=true, msg_idx=42
INFO: [SessionResumption] Handle guardado: user=214dfbc0..., resumable=true, msg_idx=87
INFO: [SessionResumption] Handle guardado: user=214dfbc0..., resumable=false, msg_idx=95
```

**Se NÃO aparecer:**
- Google Gemini pode não estar a enviar `SessionResumptionUpdate` messages
- Versão da API (`v1beta1`) pode não suportar
- Configuração `session_resumption=SessionResumptionConfig(transparent=True)` pode estar a ser ignorada pelo LiveKit SDK

### Como testar reconexão (quando Fase 2 estiver completa):

```bash
# Cenário 1: Desconexão curta (WiFi instável)
1. Iniciar conversa (2-3 min)
2. Desligar WiFi por 5-10s
3. Religar WiFi
4. Verificar se contexto foi mantido

# Cenário 2: Desconexão longa (App fechada)
1. Iniciar conversa
2. Fechar app completamente
3. Aguardar 2 minutos
4. Reabrir app
5. Verificar se inicia nova sessão (handle expirado)
```

---

## ⚠️ Limitações Conhecidas

### Limitações Atuais (Fase 1):

1. **Handles não são usados**
   - Guardamos os handles mas não os passamos ao modelo
   - Reconexão sempre inicia nova sessão

2. **Cache apenas em memória**
   - Se o backend reiniciar, todos os handles são perdidos
   - Não sobrevive a `docker compose restart`

3. **Sem sincronização frontend-backend**
   - Backend guarda handles
   - Frontend não sabe que handles existem
   - Falta API para frontend consultar disponibilidade de resumption

### Limitações do Gemini Live API:

1. **Resumption não funciona em:**
   - Meio de function call
   - Meio de geração de áudio
   - Após >10min de inatividade (handles expiram)

2. **Perda de dados:**
   - Mensagens enviadas após último checkpoint são perdidas
   - Audio/video parcial pode ser descartado

---

## 🚀 Próximos Passos

### Prioridade ALTA:

1. **Implementar Fase 2** (passar handles ao modelo)
   - [ ] Testar se LiveKit SDK aceita handles via patch
   - [ ] Se não, abrir issue no repo do LiveKit
   - [ ] Se necessário, fazer fork e implementar localmente

2. **Adicionar Persistência** (Redis)
   - [ ] Instalar Redis no Docker Compose
   - [ ] Migrar `_session_handles` para Redis com TTL
   - [ ] Permite sobreviver a restarts do backend

### Prioridade MÉDIA:

3. **Implementar Frontend** (Fase 3)
   - [ ] Detectar desconexões
   - [ ] Reconectar automaticamente
   - [ ] UX de "A reconectar..." vs "Nova conversa"

4. **Telemetria**
   - [ ] Métrica: % de handles guardados com `resumable=true`
   - [ ] Métrica: Frequência de handles (quantos por sessão)
   - [ ] Métrica: Taxa de handles expirados

### Prioridade BAIXA:

5. **API para Frontend**
   - [ ] Endpoint `/api/session-resumption-available?userId=xxx`
   - [ ] Retorna se há handle disponível
   - [ ] Frontend pode mostrar "Retomar conversa anterior" button

6. **Dashboard**
   - [ ] Ver handles guardados (admin)
   - [ ] Ver estatísticas de resumption

---

## 📝 Notas Técnicas

### Por que usar Monkey Patch?

O LiveKit Agents SDK (v1.3.10) não expõe eventos ou callbacks para `SessionResumptionUpdate`. A única forma de interceptar é fazer patch do `_handle_response` interno.

### Por que Cache Global?

As instâncias de `RealtimeSession` são criadas internamente pelo SDK. Não temos referência direta. Um cache global permite que:
1. O monkey patch guarde handles
2. O entrypoint leia handles
3. Diferentes sessões (mesmo user) partilhem estado

### Por que TTL de 10min?

Google Gemini expira handles após 10 minutos de inatividade. Armazenar handles mais antigos é inútil (reconexão falhará).

### Thread Safety?

Python GIL garante que dicionários são thread-safe para operações atómicas (get/set). Como o backend é single-threaded (asyncio), não há problemas de concorrência.

---

## 🔗 Referências

- **Gemini Live API Docs:** Página 18-19, 25 (SessionResumptionUpdate, SessionResumptionConfig)
- **LiveKit Agents SDK:** https://github.com/livekit/agents
- **Issue Template:** (se precisarmos abrir)

---

**Fim do Documento**
