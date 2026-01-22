import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { registerSession } from '@/hooks/useUserSessions';
import { CompanyLogo } from '@/components/ui/company-logo';
import { usePublicCompanySettings } from '@/hooks/usePublicCompanySettings';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100, 'Senha muito longa'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: companySettings } = usePublicCompanySettings();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    
    const { error } = await signIn(values.email, values.password);

    if (error) {
      let message = 'Erro ao fazer login';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email ou senha inválidos';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Por favor, confirme seu email antes de fazer login';
      }
      
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: message,
      });
      setIsLoading(false);
    } else {
      // Register the session after successful login
      registerSession().catch(err => {
        console.error('Failed to register session:', err);
      });
      
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso',
      });
      // Navigation is handled by Auth.tsx useEffect based on tenant status
    }
  }

  return (
    <div className="w-full max-w-md space-y-8 animate-scale-in">
      {/* Logo */}
      <div className="flex flex-col items-center space-y-4">
        {companySettings?.logo_url ? (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-2xl bg-white">
            <CompanyLogo
              logoUrl={companySettings.logo_url}
              companyName={companySettings.company_name}
              size="xl"
              className="h-16 w-16 object-contain"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl icon-gradient shadow-2xl">
            <CompanyLogo
              companyName={companySettings?.company_name}
              size="xl"
              iconClassName="text-white"
            />
          </div>
        )}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {companySettings?.company_name || 'Space Sports'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            CRM para uniformes personalizados
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-elevated">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-11 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        className="pl-11 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-12 rounded-xl btn-gradient text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center">
          <Link
            to="/auth/forgot-password"
            className="text-sm text-primary hover:text-primary-dark hover:underline transition-colors"
          >
            Esqueceu a senha?
          </Link>
        </div>
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        Não tem uma conta?{' '}
        <Link to="/auth/register" className="font-semibold text-primary hover:text-primary-dark hover:underline transition-colors">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
