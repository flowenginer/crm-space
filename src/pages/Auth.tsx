import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { useUserStore } from '@/store/userStore';

export default function Auth() {
  const navigate = useNavigate();
  const { session } = useUserStore();

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center gradient-background px-4">
      <LoginForm />
    </div>
  );
}
