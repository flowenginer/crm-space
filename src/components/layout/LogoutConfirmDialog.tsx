import { useState } from 'react';
import { LogOut, Loader2, Building2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { resetQueryCache } from '@/lib/queryClient';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogoutConfirmDialog({ open, onOpenChange }: LogoutConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, profile, tenant, reset } = useUserStore();

  const handleLogout = async () => {
    setIsLoading(true);
    
    try {
      // 1. Update profile to offline status
      if (profile?.id) {
        await supabase
          .from('profiles')
          .update({
            is_online: false,
            is_available: false,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      }

      // 2. End current session in database
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        await supabase
          .from('user_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('session_token', sessionToken);
        
        localStorage.removeItem('session_token');
      }

      // 3. Clear query cache
      resetQueryCache();

      // 4. Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      // 5. Reset local state
      reset();

      // 6. Show farewell toast
      const userName = profile?.full_name?.split(' ')[0] || 'Usuário';
      toast.success(`Até logo, ${userName}! 👋`, {
        description: 'Você foi desconectado com sucesso.',
        duration: 3000,
      });

      // 7. Close dialog and navigate
      onOpenChange(false);
      
      // Small delay for smooth transition
      setTimeout(() => {
        navigate('/auth');
      }, 100);
      
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao sair', {
        description: 'Ocorreu um erro ao desconectar. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <LogOut className="h-5 w-5 text-destructive" />
            Sair do Sistema
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Você tem certeza que deseja sair? Sua sessão será encerrada.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* User info card */}
        <div className="my-4 p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
          
          {tenant?.name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">{tenant.name}</span>
            </div>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isLoading} className="mt-0">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleLogout();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saindo...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
