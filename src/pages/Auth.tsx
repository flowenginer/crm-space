import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { useUserStore } from '@/store/userStore';
import { toast } from 'sonner';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, tenantId } = useUserStore();

  // Handle tenant_inactive error from redirect
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'tenant_inactive') {
      toast.error('Sua empresa está temporariamente desativada. Entre em contato com o suporte.');
    } else if (error === 'invalid_tenant') {
      toast.error('Sua conta não está associada a uma empresa válida. Entre em contato com o suporte.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (session && profile) {
      // Redirect based on tenant status
      if (tenantId) {
        navigate('/', { replace: true });
      } else {
        // Users without tenant cannot access - redirect to no-access page
        navigate('/no-access', { replace: true });
      }
    }
  }, [session, profile, tenantId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl" />
      </div>
      
      <LoginForm />
    </div>
  );
}
