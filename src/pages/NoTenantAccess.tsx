import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, LogOut, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/userStore';

export default function NoTenantAccess() {
  const navigate = useNavigate();
  const { profile } = useUserStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Acesso Não Autorizado</CardTitle>
          <CardDescription className="text-base">
            Sua conta não está associada a nenhuma empresa
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>
              Para acessar o sistema, você precisa ser convidado por um administrador 
              ou ter sua conta associada a uma empresa.
            </p>
            {profile?.full_name && (
              <p className="text-xs">
                Logado como: <span className="font-medium">{profile.full_name}</span>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.location.href = 'mailto:suporte@boracrm.com.br?subject=Solicitar acesso ao sistema'}
            >
              <Mail className="h-4 w-4" />
              Contatar Suporte
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full gap-2 text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sair da Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
