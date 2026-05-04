import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Shield,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  changePasswordSchema,
  evaluatePassword,
  translateSupabaseAuthError,
} from '@/lib/passwordValidation';

export default function MinhaConta() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: currentUser } = useCurrentUser();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: departmentName } = useQuery<string | null>({
    queryKey: ['minha-conta-department', profile?.department_id],
    enabled: !!profile?.department_id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!profile?.department_id) return null;
      const { data, error } = await supabase
        .from('departments')
        .select('name')
        .eq('id', profile.department_id)
        .single();
      if (error) {
        console.warn('[MinhaConta] erro ao buscar departamento:', error.message);
        return null;
      }
      return data?.name ?? null;
    },
  });

  const criteria = evaluatePassword(newPassword);
  const allCriteriaMet = newPassword.length > 0 && criteria.every((c) => c.met);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = allCriteriaMet && passwordsMatch && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = changePasswordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error(firstError?.message ?? 'Dados inválidos');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(translateSupabaseAuthError(error.message));
        return;
      }

      toast.success('Senha alterada com sucesso!');
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado';
      toast.error(translateSupabaseAuthError(message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Minha Conta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas informações pessoais e a senha de acesso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField
              icon={<User className="h-3.5 w-3.5" />}
              label="Nome"
              value={profile?.full_name || '—'}
            />
            <ReadOnlyField
              icon={<Mail className="h-3.5 w-3.5" />}
              label="E-mail"
              value={currentUser?.email || '—'}
            />
            <ReadOnlyField
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Perfil"
              value={profile?.role || '—'}
            />
            {departmentName && (
              <ReadOnlyField
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Departamento"
                value={departmentName}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" />
            Trocar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="new-password" className="text-sm mb-2 block">
                Nova senha
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="pr-10"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNew ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirm-password" className="text-sm mb-2 block">
                Confirmar nova senha
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={`pr-10 ${
                    passwordsMismatch
                      ? 'border-destructive focus-visible:ring-destructive'
                      : passwordsMatch
                        ? 'border-success focus-visible:ring-success'
                        : ''
                  }`}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordsMismatch && (
                <p className="text-xs text-destructive mt-1">As senhas não conferem</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-success mt-1">Senhas conferem</p>
              )}
            </div>

            <div
              role="list"
              aria-label="Critérios de senha"
              className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5"
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">
                A senha precisa atender:
              </p>
              {criteria.map((c) => (
                <div
                  key={c.key}
                  role="listitem"
                  data-testid={`criterion-${c.key}`}
                  data-met={c.met}
                  className="flex items-center gap-2 text-xs"
                >
                  {c.met ? (
                    <Check size={14} className="text-success shrink-0" aria-label="atendido" />
                  ) : (
                    <X size={14} className="text-muted-foreground shrink-0" aria-label="pendente" />
                  )}
                  <span className={c.met ? 'text-foreground' : 'text-muted-foreground'}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>

            <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface ReadOnlyFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ReadOnlyField({ icon, label, value }: ReadOnlyFieldProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground break-all">{value}</div>
    </div>
  );
}
