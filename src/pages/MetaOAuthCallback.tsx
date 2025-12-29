import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OAuthResult {
  type: 'META_OAUTH_SUCCESS' | 'META_OAUTH_ERROR';
  accessToken?: string;
  expiresIn?: number;
  adAccounts?: Array<{
    id: string;
    name: string;
    account_id: string;
    currency?: string;
    timezone_name?: string;
    business?: { id: string; name: string };
  }>;
  state?: string;
  error?: string;
}

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando autenticação...');
  const [accountCount, setAccountCount] = useState(0);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Handle error from Facebook
      if (error) {
        const errorResult: OAuthResult = { type: 'META_OAUTH_ERROR', error };
        sendResultAndClose(errorResult, `Erro: ${error}`);
        return;
      }

      if (!code) {
        const errorResult: OAuthResult = { type: 'META_OAUTH_ERROR', error: 'Código de autorização não encontrado' };
        sendResultAndClose(errorResult, 'Código de autorização não encontrado');
        return;
      }

      try {
        // Call edge function to exchange code for token
        const response = await fetch(
          `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-oauth?action=exchange-code&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          const errorResult: OAuthResult = { type: 'META_OAUTH_ERROR', error: data.error || 'Erro ao processar autenticação' };
          sendResultAndClose(errorResult, data.error || 'Erro ao processar autenticação');
          return;
        }

        // Success!
        const successResult: OAuthResult = {
          type: 'META_OAUTH_SUCCESS',
          accessToken: data.accessToken,
          expiresIn: data.expiresIn,
          adAccounts: data.adAccounts || [],
          state: state || undefined
        };

        setAccountCount(data.adAccounts?.length || 0);
        sendResultAndClose(successResult, 'Conexão realizada com sucesso!', true);

      } catch (err: any) {
        console.error('[MetaOAuthCallback] Error:', err);
        const errorResult: OAuthResult = { type: 'META_OAUTH_ERROR', error: err.message || 'Erro de rede' };
        sendResultAndClose(errorResult, err.message || 'Erro de rede');
      }
    };

    const sendResultAndClose = (result: OAuthResult, msg: string, isSuccess = false) => {
      setStatus(isSuccess ? 'success' : 'error');
      setMessage(msg);

      // Save to localStorage first (fallback)
      try {
        localStorage.setItem('meta_oauth_result', JSON.stringify(result));
      } catch (e) {
        console.error('[MetaOAuthCallback] localStorage error:', e);
      }

      // Try postMessage to opener
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(result, '*');
          // Auto-close after a short delay
          setTimeout(() => {
            try { window.close(); } catch (e) {}
          }, 1500);
        } catch (e) {
          console.error('[MetaOAuthCallback] postMessage error:', e);
        }
      }
    };

    processCallback();
  }, [searchParams]);

  const handleClose = () => {
    try {
      window.close();
    } catch (e) {
      // If we can't close, navigate to home
      window.location.href = '/meta-ads';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Processando...</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-green-600 mb-3">Conexão Realizada!</h1>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-green-700 text-sm">Dados enviados com sucesso!</p>
            </div>
            <p className="text-gray-600 mb-6">
              {accountCount > 0 
                ? `${accountCount} conta(s) encontrada(s). Volte para o CRM para selecionar.`
                : 'Esta janela será fechada automaticamente...'}
            </p>
            <Button onClick={handleClose} className="w-full">
              Fechar esta janela
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-red-600 mb-3">Erro na Autenticação</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{message}</p>
            </div>
            <p className="text-gray-600 mb-6">
              Volte para o CRM e tente novamente.
            </p>
            <Button onClick={handleClose} variant="destructive" className="w-full">
              Fechar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
