import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvitationByToken, useAcceptInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Building2, CheckCircle, Loader2, Mail, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const { user, isLoading: authLoading } = useAuth();
  const { data: invitation, isLoading: inviteLoading, error: inviteError } = useInvitationByToken(token);
  const acceptInvitation = useAcceptInvitation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (invitation?.email) {
      setEmail(invitation.email);
    }
  }, [invitation]);

  // If user is logged in and invitation is valid, accept it
  useEffect(() => {
    if (user && invitation && invitation.status === 'pending' && !accepted) {
      handleAccept();
    }
  }, [user, invitation, accepted]);

  const handleAccept = async () => {
    if (!user || !token) return;
    
    try {
      await acceptInvitation.mutateAsync({ token, userId: user.id });
      setAccepted(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
        },
      });

      if (error) throw error;

      if (data.user && !data.user.email_confirmed_at) {
        toast.success('Verifique seu email para confirmar o cadastro');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setIsRegistering(false);
    }
  };

  if (authLoading || inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || inviteError || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>
              Este link de convite não é válido ou já foi utilizado.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate('/auth')}>
              Ir para Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>
              {invitation.status === 'accepted' ? 'Convite Já Aceito' : 
               invitation.status === 'expired' ? 'Convite Expirado' : 
               'Convite Cancelado'}
            </CardTitle>
            <CardDescription>
              {invitation.status === 'accepted' 
                ? 'Este convite já foi utilizado.'
                : invitation.status === 'expired'
                ? 'Este convite expirou. Solicite um novo convite ao administrador.'
                : 'Este convite foi cancelado pelo administrador.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate('/auth')}>
              Ir para Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (accepted || acceptInvitation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <CardTitle>Convite Aceito!</CardTitle>
            <CardDescription>
              Você agora faz parte de {(invitation as any).tenant?.name || 'a organização'}.
              Redirecionando...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <UserPlus className="h-12 w-12 mx-auto text-primary mb-4" />
            <CardTitle>Aceitar Convite</CardTitle>
            <CardDescription>
              Você foi convidado para {(invitation as any).tenant?.name || 'uma organização'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{invitation.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{(invitation as any).tenant?.name}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={handleAccept}
              disabled={acceptInvitation.isPending}
            >
              {acceptInvitation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aceitando...
                </>
              ) : (
                'Aceitar Convite'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // User not logged in - show registration/login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <UserPlus className="h-12 w-12 mx-auto text-primary mb-4" />
          <CardTitle>
            {showLogin ? 'Entrar para Aceitar' : 'Criar Conta'}
          </CardTitle>
          <CardDescription>
            Você foi convidado para {(invitation as any).tenant?.name || 'uma organização'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={showLogin ? handleLogin : handleRegister}>
          <CardContent className="space-y-4">
            {!showLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!invitation.email}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isRegistering}>
              {isRegistering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {showLogin ? 'Entrando...' : 'Criando conta...'}
                </>
              ) : (
                showLogin ? 'Entrar' : 'Criar Conta e Aceitar'
              )}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setShowLogin(!showLogin)}
            >
              {showLogin ? 'Não tem conta? Criar agora' : 'Já tem conta? Fazer login'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
