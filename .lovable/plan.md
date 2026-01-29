
# Plano: Fallback Local para LameJS

## Problema
O áudio falha no computador da Beatriz porque o script lamejs carregado via CDN está sendo bloqueado (possivelmente por ad-blocker, firewall corporativo, ou cache corrompido). Quando o CDN falha, `window.lamejs` fica undefined e a conversão de áudio não funciona.

## Solução
Implementar um sistema de carregamento com fallback que:
1. Primeiro tenta usar o lamejs global (CDN)
2. Se falhar, carrega dinamicamente do bundle local (já instalado via npm)

## Arquivos a Modificar

### 1. Criar `src/lib/audio/lamejs-loader.ts` (novo arquivo)
Módulo centralizador que gerencia o carregamento do lamejs com fallback:

```typescript
// Estratégia:
// 1. Verificar se lamejs está disponível globalmente (CDN)
// 2. Se não, carregar dinamicamente o módulo npm
// 3. Cachear o resultado para chamadas subsequentes

let lamejsInstance: any = null;
let loadingPromise: Promise<any> | null = null;

export async function getLamejs(): Promise<any> {
  // Se já carregou, retorna
  if (lamejsInstance) return lamejsInstance;
  
  // Se está carregando, aguarda
  if (loadingPromise) return loadingPromise;
  
  loadingPromise = (async () => {
    // Tenta CDN primeiro
    if ((window as any).lamejs?.Mp3Encoder) {
      console.log('[LameJS] Using CDN version');
      lamejsInstance = (window as any).lamejs;
      return lamejsInstance;
    }
    
    // Fallback para bundle local
    console.log('[LameJS] CDN not available, loading from bundle...');
    const lamejs = await import('lamejs');
    lamejsInstance = lamejs.default || lamejs;
    
    // Disponibiliza globalmente também
    (window as any).lamejs = lamejsInstance;
    console.log('[LameJS] Loaded from bundle successfully');
    
    return lamejsInstance;
  })();
  
  return loadingPromise;
}
```

### 2. Atualizar `src/lib/audio/mp3-encoder.ts`
Substituir acesso direto ao `window.lamejs` pelo loader com fallback:

```typescript
import { getLamejs } from './lamejs-loader';

export async function encodeToMp3(audioBlob: Blob): Promise<Blob> {
  console.log('[MP3Encoder] Starting conversion, input size:', audioBlob.size);
  
  // Usa loader com fallback ao invés de acesso direto
  const lamejs = await getLamejs();
  
  if (!lamejs?.Mp3Encoder) {
    throw new Error('lamejs not loaded - Mp3Encoder not available');
  }
  
  // ... resto do código permanece igual
}
```

### 3. Atualizar `src/lib/audio/mp3-recorder.ts`
Mesmo ajuste para usar o loader com fallback:

```typescript
import { getLamejs } from './lamejs-loader';

export class Mp3Recorder {
  // ...
  
  async start(): Promise<void> {
    this.mp3Data = [];
    
    // Usa loader com fallback
    const lamejs = await getLamejs();
    
    console.log('[Mp3Recorder] Starting, lamejs:', lamejs);
    
    if (!lamejs?.Mp3Encoder) {
      throw new Error('Mp3Encoder not available - lamejs failed to load');
    }
    
    // ... resto do código permanece igual
  }
}
```

## Detalhes Técnicos

### Por que isso resolve o problema?
- O lamejs já está no `package.json` como dependência npm (`"lamejs": "^1.2.1"`)
- O Vite já tem configuração para incluí-lo no bundle (`optimizeDeps.include: ['lamejs']`)
- Se o CDN falhar, o código carrega do bundle local que já está empacotado com a aplicação
- Não depende de conexão externa para funcionar

### Fluxo de carregamento
```text
+--------------------+
|  getLamejs()       |
+--------------------+
         |
         v
+--------------------+
| window.lamejs      |-----> [OK] Usa CDN
| existe?            |
+--------------------+
         | [NÃO]
         v
+--------------------+
| import('lamejs')   |-----> Carrega do bundle
+--------------------+
         |
         v
+--------------------+
| Cacheia e retorna  |
+--------------------+
```

### Cache inteligente
- O loader cacheia a instância após primeiro carregamento
- Chamadas subsequentes retornam imediatamente
- Se múltiplas chamadas simultâneas, compartilham a mesma Promise

## Resultado Esperado
- Beatriz conseguirá gravar e enviar áudios mesmo com o CDN bloqueado
- Para outros usuários, continua usando CDN (mais rápido no primeiro acesso)
- Zero impacto para quem já funciona normalmente
