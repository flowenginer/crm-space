
# Correção de Áudio Mudo em Chamadas WebRTC

## Problema Identificado

A chamada conecta com sucesso, mas não há som porque:
1. O `remoteStream` (áudio do cliente) é recebido via WebRTC
2. **Porém, nunca é conectado a um elemento `<audio>` para reprodução**
3. O `localStream` (microfone) também não está sendo transmitido de forma audível para o cliente

## Solução: Adicionar Elementos de Áudio

### Parte 1: Reproduzir Áudio Remoto (ouvir o cliente)

| Arquivo | Modificação |
|---------|-------------|
| `src/components/calls/ActiveCallOverlay.tsx` | Adicionar elemento `<audio>` para `remoteStream` |

**Implementação:**
```tsx
import { useRef, useEffect } from 'react';

// Dentro do componente:
const remoteAudioRef = useRef<HTMLAudioElement>(null);

// Hook para conectar o stream ao audio element
useEffect(() => {
  if (remoteAudioRef.current && callState.remoteStream) {
    remoteAudioRef.current.srcObject = callState.remoteStream;
    remoteAudioRef.current.play().catch(err => {
      console.error('[Audio] Failed to play remote audio:', err);
    });
  }
}, [callState.remoteStream]);

// No JSX (invisível, apenas para reprodução):
<audio ref={remoteAudioRef} autoPlay playsInline />
```

### Parte 2: Expor `remoteStream` no Contexto

Atualmente, o `CallProvider` não expõe o `remoteStream` para os componentes filhos.

| Arquivo | Modificação |
|---------|-------------|
| `src/providers/CallProvider.tsx` | Incluir `remoteStream` no `callState` exposto |

O estado já inclui `remoteStream`, mas preciso verificar se está sendo passado corretamente.

### Parte 3: Debug do Microfone Local

Para garantir que o microfone está sendo enviado:

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useWebRTCCall.ts` | Adicionar logs de debug para tracks |

**Logs adicionais:**
```tsx
localStream.getTracks().forEach(track => {
  console.log('[WebRTC] Adding local track:', track.kind, track.enabled, track.readyState);
  pc.addTrack(track, localStream);
});
```

## Diagrama do Fluxo de Áudio Corrigido

```text
┌────────────────────────────────────────────────────────────────┐
│                        CRM (Browser)                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Microfone ──► getUserMedia() ──► localStream                  │
│                                         │                      │
│                                         ▼                      │
│                               RTCPeerConnection                │
│                                    │    │                      │
│                           addTrack()   ontrack()               │
│                                    │    │                      │
│                                    ▼    ▼                      │
│                              Meta Cloud API                    │
│                                    │    │                      │
│                                    ▼    ▼                      │
│                               remoteStream                     │
│                                         │                      │
│                                         ▼                      │
│  [FALTA] ────────────► <audio srcObject={remoteStream} />      │
│                                         │                      │
│                                         ▼                      │
│                                   Alto-falante                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/calls/ActiveCallOverlay.tsx` | Adicionar `useRef`, `useEffect` e elemento `<audio>` |
| `src/hooks/useWebRTCCall.ts` | Adicionar logs de debug para tracks de áudio |

## Código Final do `ActiveCallOverlay.tsx`

```tsx
import { useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCallContext } from '@/providers/CallProvider';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ActiveCallOverlay() {
  const { callState, hangupCall, toggleMute, isInCall } = useCallContext();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Play remote audio stream when available
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    const stream = callState.remoteStream;
    
    if (audioEl && stream) {
      console.log('[ActiveCall] Connecting remote stream to audio element');
      audioEl.srcObject = stream;
      audioEl.play().catch(err => {
        console.error('[ActiveCall] Failed to play remote audio:', err);
      });
    }
    
    return () => {
      if (audioEl) {
        audioEl.srcObject = null;
      }
    };
  }, [callState.remoteStream]);

  if (!isInCall || callState.status === 'idle') {
    return null;
  }

  // ... resto do componente igual ...

  return (
    <div className="...">
      {/* Hidden audio element for remote stream playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      
      {/* ... resto do JSX ... */}
    </div>
  );
}
```

## Benefícios

1. **Áudio bidirecional**: Você ouvirá o cliente e ele ouvirá você
2. **Debug melhorado**: Logs detalhados para identificar problemas de tracks
3. **Cleanup adequado**: Desconecta o stream quando a chamada termina

## Requisitos Técnicos

- O atributo `autoPlay` é necessário para reprodução automática
- O atributo `playsInline` é importante para iOS
- O elemento precisa estar no DOM (mesmo invisível) para funcionar
