import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useUserStore } from '@/store/userStore';

export default function Register() {
  const navigate = useNavigate();
  const { session } = useUserStore();

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center gradient-background px-4">
      <RegisterForm />
    </div>
  );
}
