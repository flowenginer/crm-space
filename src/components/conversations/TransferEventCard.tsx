import { ArrowRightLeft, Building2, User, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { ConversationEvent } from '@/hooks/useConversationEvents';

interface TransferEventCardProps {
  event: ConversationEvent;
  currentUserId?: string;
  isLatestTransfer?: boolean;
  onReturn?: () => void;
  isReturning?: boolean;
  isAdmin?: boolean;
}

export function TransferEventCard({ 
  event, 
  currentUserId, 
  isLatestTransfer, 
  onReturn,
  isReturning,
  isAdmin 
}: TransferEventCardProps) {
  const { data, created_at } = event;
  
  // Buscar nome do usuário destino se não estiver no data
  const { data: toUser } = useQuery({
    queryKey: ['profile-name', data.to_user_id],
    queryFn: async () => {
      if (!data.to_user_id) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.to_user_id)
        .single();
      return profile;
    },
    enabled: !!data.to_user_id && !data.to_user_name,
    staleTime: 60000,
  });

  // Buscar nome do usuário origem se não estiver no data
  const { data: fromUser } = useQuery({
    queryKey: ['profile-name', data.from_user_id],
    queryFn: async () => {
      if (!data.from_user_id) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.from_user_id)
        .single();
      return profile;
    },
    enabled: !!data.from_user_id && !data.from_user_name,
    staleTime: 60000,
  });

  // Buscar nome do departamento destino se não estiver no data
  const { data: toDept } = useQuery({
    queryKey: ['department-name', data.to_department_id],
    queryFn: async () => {
      if (!data.to_department_id) return null;
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', data.to_department_id)
        .single();
      return dept;
    },
    enabled: !!data.to_department_id && !data.to_department_name,
    staleTime: 60000,
  });

  // Determinar origem: se é auto-distribuição ou tem actor, usar nome apropriado
  const isAutoDistribution = (data as any).is_auto_distribution === true;
  const fromName = data.from_user_name || (isAutoDistribution ? 'Distribuição Automática' : 'Sistema');
  
  // Determinar destino: preferir nome já no evento, senão buscar
  const toName = data.to_user_name || toUser?.full_name || data.to_department_name || toDept?.name || 
    (data.to_user_id || data.to_department_id ? 'Carregando...' : 'Sem destino');
  
  const isTransferToDepartment = !!data.to_department_id && !data.to_user_id;
  const isReturn = (data as any).is_return === true;

  // Show return button only if:
  // 1. It's the latest transfer event
  // 2. Current user is the recipient (to_user_id matches currentUserId) OR is admin
  // 3. There's a from_user_id to return to
  // 4. It's not already a return (to avoid return of return)
  const canReturn = 
    isLatestTransfer && 
    currentUserId && 
    (data.to_user_id === currentUserId || isAdmin) && 
    data.from_user_id && 
    !isReturn &&
    onReturn;

  const formattedDate = format(new Date(created_at), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <div className="flex justify-center my-3">
      <div className="bg-blue-500/15 dark:bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <ArrowRightLeft size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {isReturn ? 'Conversa devolvida' : 'Conversa transferida'}
              </p>
              
              {canReturn && (
                <Button
                  onClick={onReturn}
                  disabled={isReturning}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-500/20 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Undo2 size={12} />
                  {isReturning ? 'Devolvendo...' : 'Devolver'}
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-600/80 dark:text-blue-400/80">
              <span className="font-medium">{fromName}</span>
              <span>→</span>
              <span className="flex items-center gap-1">
                {isTransferToDepartment ? (
                  <Building2 size={12} />
                ) : (
                  <User size={12} />
                )}
                <span className="font-medium">{toName}</span>
              </span>
            </div>
            
            {data.note && !isReturn && (
              <p className="mt-2 text-xs text-blue-600/70 dark:text-blue-400/70 italic">
                "{data.note}"
              </p>
            )}
            
            <p className="mt-1.5 text-[10px] text-blue-500/60 dark:text-blue-400/50">
              {formattedDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
