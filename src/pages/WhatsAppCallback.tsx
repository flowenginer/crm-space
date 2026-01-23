import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function WhatsAppCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('[WhatsApp Callback] Received params:', {
      hasCode: !!code,
      state,
      error,
      errorDescription,
    });

    // Validate state
    const savedState = sessionStorage.getItem('fb_oauth_state');

    if (error) {
      // Send error to parent window
      const result = {
        type: 'WHATSAPP_OAUTH_RESULT',
        error: errorDescription || error,
      };

      // Try postMessage first
      if (window.opener) {
        window.opener.postMessage(result, window.location.origin);
        setTimeout(() => window.close(), 100);
      } else {
        // Fallback to localStorage
        localStorage.setItem('whatsapp_oauth_result', JSON.stringify({
          type: 'WHATSAPP_OAUTH_ERROR',
          error: errorDescription || error,
        }));
        window.close();
      }
      return;
    }

    if (!code) {
      const result = {
        type: 'WHATSAPP_OAUTH_RESULT',
        error: 'Nenhum codigo de autorizacao recebido',
      };

      if (window.opener) {
        window.opener.postMessage(result, window.location.origin);
        setTimeout(() => window.close(), 100);
      } else {
        localStorage.setItem('whatsapp_oauth_result', JSON.stringify({
          type: 'WHATSAPP_OAUTH_ERROR',
          error: 'Nenhum codigo de autorizacao recebido',
        }));
        window.close();
      }
      return;
    }

    if (state && savedState && state !== savedState) {
      const result = {
        type: 'WHATSAPP_OAUTH_RESULT',
        error: 'Estado de seguranca invalido',
      };

      if (window.opener) {
        window.opener.postMessage(result, window.location.origin);
        setTimeout(() => window.close(), 100);
      } else {
        localStorage.setItem('whatsapp_oauth_result', JSON.stringify({
          type: 'WHATSAPP_OAUTH_ERROR',
          error: 'Estado de seguranca invalido',
        }));
        window.close();
      }
      return;
    }

    // Clear state
    sessionStorage.removeItem('fb_oauth_state');

    // Success - send code back to parent
    const result = {
      type: 'WHATSAPP_OAUTH_RESULT',
      code: code,
    };

    console.log('[WhatsApp Callback] Sending result to parent');

    if (window.opener) {
      window.opener.postMessage(result, window.location.origin);
      setTimeout(() => window.close(), 100);
    } else {
      // Fallback to localStorage for cases where popup reference is lost
      localStorage.setItem('whatsapp_oauth_result', JSON.stringify({
        type: 'WHATSAPP_OAUTH_SUCCESS',
        code: code,
      }));
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Processando autorizacao...</p>
        <p className="text-sm text-muted-foreground">Esta janela fechara automaticamente.</p>
      </div>
    </div>
  );
}
