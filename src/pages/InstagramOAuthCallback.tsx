import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OAuthResult {
  type: 'INSTAGRAM_OAUTH_SUCCESS' | 'INSTAGRAM_OAUTH_ERROR';
  accounts?: any[];
  error?: string;
}

export default function InstagramOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando autenticação...');
  const [accountCount, setAccountCount] = useState(0);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        sendResult({ type: 'INSTAGRAM_OAUTH_ERROR', error }, `Erro: ${error}`);
        return;
      }

      if (!code) {
        sendResult({ type: 'INSTAGRAM_OAUTH_ERROR', error: 'Código não encontrado' }, 'Código não encontrado');
        return;
      }

      try {
        const response = await fetch(
          `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/instagram-oauth?action=exchange-code&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          sendResult({ type: 'INSTAGRAM_OAUTH_ERROR', error: data.error || 'Erro ao processar' }, data.error || 'Erro');
          return;
        }

        setAccountCount(data.accounts?.length || 0);
        sendResult({
          type: 'INSTAGRAM_OAUTH_SUCCESS',
          accounts: data.accounts || [],
        }, 'Contas encontradas!', true);

      } catch (err: any) {
        sendResult({ type: 'INSTAGRAM_OAUTH_ERROR', error: err.message }, err.message);
      }
    };

    const sendResult = (result: OAuthResult, msg: string, isSuccess = false) => {
      setStatus(isSuccess ? 'success' : 'error');
      setMessage(msg);

      try {
        localStorage.setItem('instagram_oauth_result', JSON.stringify(result));
      } catch (e) {}

      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(result, '*');
          setTimeout(() => { try { window.close(); } catch (e) {} }, 1500);
        } catch (e) {}
      }
    };

    processCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)' }}>
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-pink-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Processando...</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-green-600 mb-3">Contas Encontradas!</h1>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-green-700 text-sm">{accountCount} conta(s) Instagram encontrada(s)</p>
            </div>
            <p className="text-gray-600 mb-6">Volte ao CRM para selecionar a conta.</p>
            <Button onClick={() => { try { window.close(); } catch { window.location.href = '/channels'; }}} className="w-full">
              Fechar esta janela
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-red-600 mb-3">Erro</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{message}</p>
            </div>
            <Button onClick={() => { try { window.close(); } catch { window.location.href = '/channels'; }}} variant="destructive" className="w-full">
              Fechar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
