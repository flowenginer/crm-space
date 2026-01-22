import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { CompanyLogo } from '@/components/ui/company-logo';
import { usePublicCompanySettings } from '@/hooks/usePublicCompanySettings';

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100, 'Senha muito longa'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, 'Você deve aceitar os termos'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: companySettings } = usePublicCompanySettings();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setIsLoading(true);
    
    const { error } = await signUp(values.email, values.password, values.fullName);

    if (error) {
      let message = 'Erro ao criar conta';
      if (error.message.includes('User already registered')) {
        message = 'Este email já está cadastrado';
      } else if (error.message.includes('Password should be')) {
        message = 'Senha muito fraca. Use letras e números.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: message,
      });
      setIsLoading(false);
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Verifique seu email para confirmar o cadastro',
      });
      // After email confirmation, user will be redirected to onboarding by Register.tsx
      navigate('/auth');
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
            Criar Conta
          </h1>
          <p className="mt-2 text-muted-foreground">
            Preencha os dados para se cadastrar
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-elevated">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Nome completo</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="Seu nome"
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

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Confirmar senha</FormLabel>
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

            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal text-muted-foreground">
                      Aceito os{' '}
                      <Link to="/terms" className="text-primary hover:underline">
                        termos de uso
                      </Link>
                    </FormLabel>
                    <FormMessage />
                  </div>
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
                  Criando conta...
                </>
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>
        </Form>
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link to="/auth" className="font-semibold text-primary hover:text-primary-dark hover:underline transition-colors">
          Fazer login
        </Link>
      </p>
    </div>
  );
}
