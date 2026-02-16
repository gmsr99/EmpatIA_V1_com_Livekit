# Frontend EmpatIA - Propostas de Melhoria

**Data:** 2026-02-16
**Versão:** 1.0
**Foco:** UX para Idosos (65+) + Session Resumption

---

## 📊 Análise do Estado Atual

### ✅ O que já funciona bem:

1. **Visual Clean** - Interface minimalista sem distrações
2. **Glowing Ring Visualizer** - Feedback visual bonito do áudio
3. **Auth Flow** - NextAuth integrado
4. **LiveKit Integration** - Conexão voice funcional
5. **Error Handling** - Mensagens de erro básicas

### ⚠️ Pontos a Melhorar:

1. **Sem reconexão automática** - Se internet cai, user tem que reconectar manualmente
2. **Feedback de estado limitado** - Não é claro quando agent está "a pensar" vs "a falar"
3. **Botões pequenos** - Difícil de clicar para idosos com motricidade reduzida
4. **Sem indicador de quem está a falar** - User vs Agent
5. **Mensagens de erro técnicas** - "Failed to connect" não ajuda idosos
6. **Sem tutorial** - Idosos não sabem como usar
7. **Sem feedback de volume** - Não sabem se estão a falar alto o suficiente
8. **Sem histórico** - Não conseguem rever conversas passadas

---

## 🎯 Melhorias Propostas (Prioridade)

### **🔴 ALTA PRIORIDADE** (Fazer já)

#### 1. **Reconexão Automática com UX Amigável**

**Problema:**

- Se WiFi falha, sessão perde-se e user tem que clicar "Conversar Agora" de novo
- Backend já tem Session Resumption (v2.1), mas frontend não usa

**Solução:**

```tsx
// components/app/homepage-voice-agent.tsx - ADICIONAR
import { RoomEvent } from 'livekit-client';

function AgentVisualizer({ onDisconnect }: { onDisconnect: () => void }) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { room } = useRoomContext();

  useEffect(() => {
    if (!room) return;

    // Detectar desconexão
    room.on(RoomEvent.Disconnected, async (reason) => {
      console.log('[Reconnection] Desconectado:', reason);

      // Se foi user que desligou, não reconectar
      if (reason === 'CLIENT_INITIATED') {
        return;
      }

      // Guardar estado para reconexão
      saveReconnectionState({
        roomName: room.name,
        timestamp: Date.now(),
      });

      // Mostrar UI de reconexão
      setIsReconnecting(true);

      // Tentar reconectar (max 3 tentativas)
      for (let i = 0; i < 3; i++) {
        setReconnectAttempts(i + 1);
        await sleep(2000); // Esperar 2s entre tentativas

        try {
          await room.connect(livekitUrl, token);
          setIsReconnecting(false);
          toast.success('Reconectado! A continuar a conversa...');
          return;
        } catch (error) {
          console.error(`Tentativa ${i + 1} falhou:`, error);
        }
      }

      // Se falhou 3 vezes, mostrar mensagem amigável
      setIsReconnecting(false);
      toast.error('Vamos começar de novo. Como está hoje?');
      onDisconnect();
    });

    return () => {
      room.removeAllListeners();
    };
  }, [room, onDisconnect]);

  // UI de reconexão
  if (isReconnecting) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <Loader2 className="text-brand-lilac h-12 w-12 animate-spin" />
        <div className="text-center">
          <p className="text-lg font-medium text-white">A reconectar...</p>
          <p className="text-sm text-white/60">Tentativa {reconnectAttempts}/3</p>
        </div>
      </div>
    );
  }

  // ... resto do código
}
```

**Benefício:**

- ✅ Idosos com WiFi instável não perdem a conversa
- ✅ UX transparente - nem percebem que desconectou
- ✅ Mensagens em PT-PT amigáveis

---

#### 2. **Indicador de "Quem Está a Falar"**

**Problema:**

- Não é claro se o agente está a ouvir ou a falar
- Idosos interrompem o agente sem querer

**Solução:**

```tsx
// components/app/speaking-indicator.tsx - NOVO FICHEIRO

export function SpeakingIndicator({
  isAgentSpeaking,
  isUserSpeaking,
}: {
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
}) {
  return (
    <div className="absolute top-20 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {/* Agent a falar */}
      {isAgentSpeaking && (
        <div className="border-brand-lilac/50 bg-brand-lilac/10 flex animate-pulse items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-md">
          <div className="bg-brand-lilac h-2 w-2 animate-ping rounded-full" />
          <span className="text-sm font-medium text-white">EmpatIA está a falar...</span>
        </div>
      )}

      {/* User a falar */}
      {isUserSpeaking && (
        <div className="flex items-center gap-2 rounded-full border border-green-500/50 bg-green-500/10 px-4 py-2 backdrop-blur-md">
          <Mic className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-white">Estou a ouvir...</span>
        </div>
      )}
    </div>
  );
}
```

**Como detectar:**

```tsx
// No AgentVisualizer, usar useTracks para detectar atividade

const agentTracks = useTracks([Track.Source.Microphone], {
  onlySubscribed: true,
}).filter((t) => t.participant instanceof RemoteParticipant);

const isAgentSpeaking = agentTracks.some((track) => track.publication?.isSpeaking);

const { isSpeaking: isUserSpeaking } = useLocalParticipant();
```

**Benefício:**

- ✅ Idosos sabem quando podem falar
- ✅ Reduz interrupções acidentais
- ✅ Feedback visual claro

---

#### 3. **Botões Maiores e Mais Acessíveis**

**Problema:**

- Botões de 48px (12 tailwind) são pequenos para idosos
- Difícil de clicar com tremor ou artrite

**Solução:**

```tsx
// Aumentar de h-12 w-12 para h-16 w-16

<Button
  variant="ghost"
  size="icon"
  onClick={toggleMic}
  className="h-16 w-16 rounded-full border-2 backdrop-blur-md transition-all"
>
  {isMicrophoneEnabled ? (
    <Mic className="h-8 w-8" />  {/* Era h-6 w-6 */}
  ) : (
    <MicOff className="h-8 w-8" />
  )}
</Button>

<Button
  variant="destructive"
  size="icon"
  className="h-16 w-16 rounded-full border-2"
  onClick={onDisconnect}
>
  <X className="h-8 w-8" />
</Button>
```

**Adicionar labels:**

```tsx
<div className="flex flex-col items-center gap-1">
  <Button ... />
  <span className="text-xs text-white/70">Microfone</span>
</div>

<div className="flex flex-col items-center gap-1">
  <Button ... />
  <span className="text-xs text-white/70">Desligar</span>
</div>
```

**Benefício:**

- ✅ Mais fácil de clicar (área 78% maior)
- ✅ Labels clarificam função
- ✅ Melhor para motricidade reduzida

---

#### 4. **Mensagens de Erro Amigáveis**

**Problema:**

- Erros técnicos: "Failed to connect", "Media Device Failure"
- Idosos não sabem o que fazer

**Solução:**

```tsx
// Criar helper para traduzir erros técnicos

function getFriendlyErrorMessage(error: unknown): string {
  const errorStr = String(error);

  if (errorStr.includes('NotAllowedError') || errorStr.includes('Permission denied')) {
    return 'O EmpatIA precisa de aceder ao seu microfone. Por favor, clique em "Permitir" quando o navegador perguntar.';
  }

  if (errorStr.includes('NotFoundError')) {
    return 'Não conseguimos encontrar o seu microfone. Verifique se tem um ligado ao computador.';
  }

  if (errorStr.includes('NetworkError') || errorStr.includes('Failed to connect')) {
    return 'Parece que a internet está lenta. Vamos tentar novamente em alguns segundos.';
  }

  if (errorStr.includes('timeout')) {
    return 'A chamada demorou muito tempo. Vamos tentar de novo?';
  }

  // Default amigável
  return 'Algo correu mal. Não se preocupe, vamos tentar resolver. Tente novamente dentro de momentos.';
}
```

**Usar no código:**

```tsx
catch (e) {
  const friendlyMessage = getFriendlyErrorMessage(e);
  setError(friendlyMessage);

  // Mostrar botão de ação sempre
  toast.error(friendlyMessage, {
    action: {
      label: 'Tentar Novamente',
      onClick: () => connect(),
    },
  });
}
```

**Benefício:**

- ✅ Mensagens em linguagem simples
- ✅ Sempre indica próximo passo
- ✅ Reduz frustração

---

### **🟡 MÉDIA PRIORIDADE** (Fazer em 1-2 semanas)

#### 5. **Indicador de Volume de Voz**

**Problema:**

- Idosos não sabem se estão a falar alto o suficiente
- Alguns falam muito baixo, outros gritam

**Solução:**

```tsx
// components/app/volume-indicator.tsx - NOVO

export function VolumeIndicator({ stream }: { stream?: MediaStream }) {
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setVolume(avg / 255); // Normalize to 0-1
      requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      source.disconnect();
      audioContext.close();
    };
  }, [stream]);

  const getVolumeLabel = () => {
    if (volume < 0.1) return { text: 'Fale mais alto', color: 'text-red-400' };
    if (volume < 0.3) return { text: 'Ótimo!', color: 'text-green-400' };
    return { text: 'Demasiado alto', color: 'text-orange-400' };
  };

  const { text, color } = getVolumeLabel();

  return (
    <div className="flex items-center gap-2">
      {/* Barra de volume */}
      <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
          style={{ width: `${volume * 100}%` }}
        />
      </div>
      <span className={`text-xs ${color}`}>{text}</span>
    </div>
  );
}
```

**Benefício:**

- ✅ Feedback em tempo real
- ✅ Ajuda a ajustar volume
- ✅ Melhora qualidade das conversas

---

#### 6. **Tutorial de Primeira Utilização**

**Problema:**

- Idosos não sabem como usar pela primeira vez
- Abandonam antes de tentar

**Solução:**

```tsx
// components/app/onboarding-tutorial.tsx - NOVO

export function OnboardingTutorial({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: 'Bem-vindo à EmpatIA!',
      description: 'Sou a sua companheira para conversas. Vamos aprender como funciona?',
      icon: '👋',
    },
    {
      title: 'Clique em "Conversar Agora"',
      description:
        'Quando clicar, o seu navegador vai pedir permissão para usar o microfone. Clique em "Permitir".',
      icon: '🎤',
    },
    {
      title: 'Fale Naturalmente',
      description:
        'Pode falar comigo como se estivesse a conversar com uma amiga. Não precisa de gritar!',
      icon: '💬',
    },
    {
      title: 'Estou Sempre a Ouvir',
      description:
        'Quando vir os anéis a brilhar, estou a ouvi-lo. Pode fazer pausas, não há pressa.',
      icon: '👂',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-black p-8 shadow-2xl">
        <div className="mb-6 text-center text-6xl">{steps[step - 1].icon}</div>

        <h2 className="mb-3 text-center text-2xl font-bold text-white">{steps[step - 1].title}</h2>

        <p className="mb-6 text-center text-white/70">{steps[step - 1].description}</p>

        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-all ${
                i + 1 === step ? 'bg-brand-lilac w-6' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              Anterior
            </Button>
          )}

          <Button
            onClick={() => {
              if (step === steps.length) {
                localStorage.setItem('empatia_tutorial_completed', 'true');
                onComplete();
              } else {
                setStep(step + 1);
              }
            }}
            className="flex-1"
          >
            {step === steps.length ? 'Começar!' : 'Próximo'}
          </Button>
        </div>

        {step === steps.length && (
          <button
            onClick={() => {
              localStorage.setItem('empatia_tutorial_completed', 'true');
              onComplete();
            }}
            className="mt-4 w-full text-center text-sm text-white/50 hover:text-white/70"
          >
            Já sei, saltar tutorial
          </button>
        )}
      </div>
    </div>
  );
}
```

**Integrar:**

```tsx
// No homepage-voice-agent.tsx

const [showTutorial, setShowTutorial] = useState(false);

useEffect(() => {
  const completed = localStorage.getItem('empatia_tutorial_completed');
  if (!completed) {
    setShowTutorial(true);
  }
}, []);

return (
  <>
    {showTutorial && <OnboardingTutorial onComplete={() => setShowTutorial(false)} />}
    {/* ... resto do código */}
  </>
);
```

**Benefício:**

- ✅ Reduz abandono
- ✅ Educa utilizadores
- ✅ Apenas aparece uma vez

---

#### 7. **Estado de "A Pensar..." quando Tool é Chamada**

**Problema:**

- Quando agent chama `recall_memories`, há pausa de 2-5s
- User pensa que parou de funcionar

**Solução:**

```tsx
// Adicionar listener para tool calls
import { DataPacket_Kind } from 'livekit-client';

function AgentVisualizer({ onDisconnect }: { onDisconnect: () => void }) {
  const [isThinking, setIsThinking] = useState(false);
  const { room } = useRoomContext();

  useEffect(() => {
    if (!room) return;

    // Receber data packets do agent
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      if (participant?.isAgent) {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));

          if (data.type === 'tool_call_start') {
            setIsThinking(true);
          }

          if (data.type === 'tool_call_end') {
            setIsThinking(false);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });
  }, [room]);

  return (
    <>
      {isThinking && (
        <div className="absolute top-24 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-purple-500/50 bg-purple-500/10 px-4 py-2 backdrop-blur-md">
          <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
          <span className="text-sm text-white">A recordar...</span>
        </div>
      )}
      {/* ... resto */}
    </>
  );
}
```

**Backend precisa enviar data packets:**

```python
# agent.py - dentro da tool recall_memories

@llm.function_tool(...)
async def recall_memories(topic: str) -> str:
    # Enviar data packet ao frontend
    await room.local_participant.publish_data(
        json.dumps({"type": "tool_call_start", "tool": "recall_memories"}).encode(),
        kind=DataPacket_Kind.RELIABLE
    )

    try:
        # ... fazer busca ...
        return output
    finally:
        await room.local_participant.publish_data(
            json.dumps({"type": "tool_call_end"}).encode(),
            kind=DataPacket_Kind.RELIABLE
        )
```

**Benefício:**

- ✅ User sabe que agent está a processar
- ✅ Evita confusão com pausas longas
- ✅ Feedback visual consistente

---

### **🟢 BAIXA PRIORIDADE** (Considerar futuro)

#### 8. **Histórico de Conversas Simples**

**UI:**

```tsx
// Dashboard simples para ver últimas 5 conversas

export function ConversationHistory() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetch('/api/sessions/recent')
      .then((r) => r.json())
      .then(setSessions);
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-2xl font-bold">As Minhas Conversas</h2>

      {sessions.map((session) => (
        <div key={session.id} className="mb-4 rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">{formatDate(session.created_at)}</span>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs">{session.duration}min</span>
          </div>
          <p className="text-gray-700">{session.summary}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 📋 Checklist de Implementação

### Fase 1 (Esta semana):

- [ ] Reconexão automática com UX amigável
- [ ] Indicador "Quem está a falar"
- [ ] Botões maiores (h-16 w-16)
- [ ] Mensagens de erro amigáveis

### Fase 2 (Próximas 2 semanas):

- [ ] Indicador de volume de voz
- [ ] Tutorial de primeira utilização
- [ ] Estado "A pensar..." para tool calls
- [ ] Labels nos botões

### Fase 3 (Futuro):

- [ ] Histórico de conversas
- [ ] Dashboard para familiares
- [ ] Modo escuro/claro (contraste para baixa visão)
- [ ] Atalhos de teclado (ESPAÇO = falar, ESC = desligar)

---

## 🎨 Guia de Estilo para Idosos

### Fontes:

- **Mínimo:** 16px para texto, 20px para botões
- **Recomendado:** 18-24px para texto principal
- **Família:** Sans-serif (melhor legibilidade)

### Cores:

- **Contraste mínimo:** 4.5:1 (WCAG AA)
- **Evitar:** Vermelho/verde juntos (daltonismo)
- **Preferir:** Azul, roxo, amarelo (alta visibilidade)

### Interação:

- **Botões:** Mínimo 44x44px (iOS HIG), recomendado 64x64px para idosos
- **Espaçamento:** Mínimo 8px entre elementos clicáveis
- **Feedback:** Sempre visual + auditivo quando possível

### Mensagens:

- **Linguagem:** Simples, direta, positiva
- **Evitar:** Jargão técnico ("timeout", "network error")
- **Preferir:** "Vamos tentar de novo?", "Algo correu mal"

---

## 🧪 Testing com Idosos

### Checklist de Usability Testing:

- [ ] User consegue conectar sozinho?
- [ ] User entende quando pode falar?
- [ ] User sabe como desligar chamada?
- [ ] Mensagens de erro fazem sentido?
- [ ] Botões são fáceis de clicar?
- [ ] Texto é legível (pedir tirar óculos)?
- [ ] User sente-se confortável a falar?

### Métricas de Sucesso:

- **Time to First Conversation:** < 2 minutos
- **Abandonment Rate:** < 10%
- **Reconnection Success Rate:** > 80%
- **Error Recovery Rate:** > 90%

---

**Fim do Documento**

## Trigger Deploy Mon Feb 16 12:57:06 WET 2026
