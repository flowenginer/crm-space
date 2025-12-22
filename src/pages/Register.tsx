import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useUserStore } from '@/store/userStore';

export default function Register() {
  const navigate = useNavigate();
  const { session, profile, tenantId } = useUserStore();

  useEffect(() => {
    if (session && profile) {
      // New users always go to onboarding
      if (tenantId) {
        navigate('/', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
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
      
      <RegisterForm />
    </div>
  );
}
