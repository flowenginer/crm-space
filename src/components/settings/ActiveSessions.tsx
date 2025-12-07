import { Monitor, Smartphone, Tablet, Loader2, X } from 'lucide-react';
import { useUserSessions, useEndSession, useEndOtherSessions, UserSession } from '@/hooks/useUserSessions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Tablet;
    default:
      return Monitor;
  }
}

function formatLocation(session: UserSession): string {
  const parts: string[] = [];
  if (session.city) parts.push(session.city);
  if (session.region) parts.push(session.region);
  if (session.country) parts.push(session.country);
  
  if (parts.length === 0) return 'Localização desconhecida';
  return parts.slice(0, 2).join(', '); // Max 2 parts to keep it short
}

function formatLastActivity(session: UserSession): string {
  if (session.is_current) return 'Ativo agora';
  
  if (!session.last_activity_at) return '';
  
  try {
    return formatDistanceToNow(new Date(session.last_activity_at), {
      addSuffix: true,
      locale: ptBR,
    });
  } catch {
    return '';
  }
}

export function ActiveSessions() {
  const { data: sessions = [], isLoading, error } = useUserSessions();
  const endSession = useEndSession();
  const endOtherSessions = useEndOtherSessions();

  const handleEndSession = async (sessionId: string) => {
    try {
      await endSession.mutateAsync(sessionId);
      toast.success('Sessão encerrada com sucesso');
    } catch (err) {
      toast.error('Erro ao encerrar sessão');
    }
  };

  const handleEndOtherSessions = async () => {
    const otherSessions = sessions.filter(s => !s.is_current);
    if (otherSessions.length === 0) {
      toast.info('Não há outras sessões para encerrar');
      return;
    }

    try {
      await endOtherSessions.mutateAsync();
      toast.success(`${otherSessions.length} sessão(ões) encerrada(s)`);
    } catch (err) {
      toast.error('Erro ao encerrar sessões');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-6">Sessões Ativas</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-6">Sessões Ativas</h3>
        <p className="text-muted-foreground text-sm">Erro ao carregar sessões</p>
      </div>
    );
  }

  const otherSessionsCount = sessions.filter(s => !s.is_current).length;

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Sessões Ativas</h3>
        <span className="text-sm text-muted-foreground">
          {sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'}
        </span>
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">
          Nenhuma sessão ativa encontrada
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.device_type);
            const location = formatLocation(session);
            const lastActivity = formatLastActivity(session);
            
            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                  session.is_current 
                    ? 'bg-status-success/5 border border-status-success/20' 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    session.is_current 
                      ? 'bg-status-success/10' 
                      : 'bg-muted'
                  }`}>
                    <DeviceIcon 
                      size={20} 
                      className={session.is_current ? 'text-status-success' : 'text-muted-foreground'} 
                    />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">
                      {session.browser || 'Navegador'} - {session.os || 'Sistema'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {location} • {lastActivity}
                    </div>
                  </div>
                </div>

                {session.is_current ? (
                  <span className="px-2.5 py-1 bg-status-success/10 text-status-success rounded-full text-xs font-medium">
                    Sessão atual
                  </span>
                ) : (
                  <button
                    onClick={() => handleEndSession(session.id)}
                    disabled={endSession.isPending}
                    className="p-2 hover:bg-status-error/10 rounded-lg transition-colors group"
                    title="Encerrar sessão"
                  >
                    {endSession.isPending ? (
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    ) : (
                      <X size={16} className="text-muted-foreground group-hover:text-status-error" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {otherSessionsCount > 0 && (
        <button
          onClick={handleEndOtherSessions}
          disabled={endOtherSessions.isPending}
          className="mt-4 px-4 py-2 border border-status-error/30 text-status-error rounded-xl hover:bg-status-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {endOtherSessions.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Encerrando...
            </>
          ) : (
            `Encerrar todas as outras sessões (${otherSessionsCount})`
          )}
        </button>
      )}
    </div>
  );
}
