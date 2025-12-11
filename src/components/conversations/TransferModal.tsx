import { useState, useMemo, useEffect } from 'react';
import { ArrowRightLeft, Building2, User, Loader2, ShieldAlert, Users, PinOff, Check, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useAllUserDepartments } from '@/hooks/useUserDepartments';
import { useTransferConversation } from '@/hooks/useConversationEvents';
import { usePinnedConversations, useUnpinConversation } from '@/hooks/usePinnedConversations';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  onTransferSuccess?: () => void;
  conversationId: string;
  currentAssignedTo?: string | null;
  currentDepartmentId?: string | null;
}

type TransferType = 'user' | 'department';

export function TransferModal({
  open,
  onClose,
  onTransferSuccess,
  conversationId,
  currentAssignedTo,
  currentDepartmentId,
}: TransferModalProps) {
  const [transferType, setTransferType] = useState<TransferType>('user');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [note, setNote] = useState('');
  const [shouldUnpin, setShouldUnpin] = useState(true);

  const { data: departments = [], isLoading: isDepartmentsLoading } = useDepartments();
  const { data: team = [] } = useTeam();
  const { data: allUserDepartments = [] } = useAllUserDepartments();
  const { data: pinnedConversations = [] } = usePinnedConversations();
  const unpinConversation = useUnpinConversation();
  const transferConversation = useTransferConversation();
  const { can } = usePermissions();
  const { user } = useAuth();

  const isConversationPinned = pinnedConversations.some(p => p.conversation_id === conversationId);
  const activeDepartments = departments.filter(d => d.is_active);

  useEffect(() => {
    setSelectedUserId('');
  }, [selectedDepartmentId, transferType]);

  const teamInDepartment = useMemo(() => {
    if (!selectedDepartmentId) return [];
    
    const usersInDepartment = allUserDepartments
      .filter(ud => ud.department_id === selectedDepartmentId)
      .map(ud => ud.user_id);
    
    return team.filter(member => 
      member.id !== currentAssignedTo &&
      (usersInDepartment.includes(member.id) || member.department_id === selectedDepartmentId)
    );
  }, [team, selectedDepartmentId, allUserDepartments, currentAssignedTo]);

  const canTransfer = (): boolean => {
    return can.transferConversations();
  };

  const handleTransfer = async () => {
    if (!canTransfer()) {
      toast.error('Sem permissão para transferir', {
        icon: <ShieldAlert className="text-destructive" size={18} />,
        description: 'Você só pode transferir conversas atribuídas a você.',
      });
      return;
    }

    if (!selectedDepartmentId) {
      toast.error('Selecione um departamento');
      return;
    }

    if (transferType === 'user' && !selectedUserId) {
      toast.error('Selecione um atendente');
      return;
    }

    const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
    const selectedUser = transferType === 'user' ? team.find(t => t.id === selectedUserId) : null;

    try {
      if (isConversationPinned && shouldUnpin) {
        await unpinConversation.mutateAsync(conversationId);
      }

      await transferConversation.mutateAsync({
        conversationId,
        toUserId: transferType === 'user' ? selectedUserId : null,
        toUserName: selectedUser?.full_name || null,
        toDepartmentId: selectedDepartmentId,
        toDepartmentName: selectedDepartment?.name || null,
        note: note.trim() || undefined,
      });

      const successMessage = transferType === 'department' 
        ? `Conversa enviada para a fila de ${selectedDepartment?.name || 'departamento'}`
        : 'Conversa transferida com sucesso';
      
      toast.success(successMessage);
      
      if (onTransferSuccess) {
        onTransferSuccess();
      }
      
      handleClose();
    } catch (error) {
      console.error('Error transferring conversation:', error);
      toast.error('Erro ao transferir conversa');
    }
  };

  const handleClose = () => {
    setTransferType('user');
    setSelectedDepartmentId('');
    setSelectedUserId('');
    setNote('');
    setShouldUnpin(true);
    onClose();
  };

  const userCanTransfer = canTransfer();
  const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header com gradiente */}
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/5 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <ArrowRightLeft className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Transferir Conversa</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Selecione o destino da transferência
              </p>
            </div>
          </div>
        </DialogHeader>

        {!userCanTransfer ? (
          <div className="p-8">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="text-destructive" size={32} />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">Sem permissão</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Você não pode transferir esta conversa pois ela pertence a outro atendente.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Tipo de Transferência */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">Tipo de transferência</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTransferType('user')}
                  className={cn(
                    'relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
                    transferType === 'user' 
                      ? 'border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/10' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {transferType === 'user' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                    transferType === 'user' 
                      ? 'bg-gradient-to-br from-primary to-purple-600 text-white' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <User size={16} />
                  </div>
                  <div className="text-left min-w-0">
                    <p className={cn(
                      'text-sm font-medium',
                      transferType === 'user' ? 'text-primary' : 'text-foreground'
                    )}>
                      Para atendente
                    </p>
                    <p className="text-xs text-muted-foreground">Atribuição direta</p>
                  </div>
                </button>
                <button
                  onClick={() => setTransferType('department')}
                  className={cn(
                    'relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
                    transferType === 'department' 
                      ? 'border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/10' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {transferType === 'department' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                    transferType === 'department' 
                      ? 'bg-gradient-to-br from-primary to-purple-600 text-white' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <Users size={16} />
                  </div>
                  <div className="text-left min-w-0">
                    <p className={cn(
                      'text-sm font-medium',
                      transferType === 'department' ? 'text-primary' : 'text-foreground'
                    )}>
                      Para fila
                    </p>
                    <p className="text-xs text-muted-foreground">Aba "Pendentes"</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Departamentos */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 size={14} className="text-primary" />
                Departamento
              </Label>
              {isDepartmentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {activeDepartments.map((dept) => {
                    const usersCount = allUserDepartments.filter(ud => ud.department_id === dept.id).length;
                    const isSelected = selectedDepartmentId === dept.id;
                    return (
                      <button
                        key={dept.id}
                        onClick={() => setSelectedDepartmentId(dept.id)}
                        className={cn(
                          'relative flex items-center justify-between p-2.5 rounded-lg border-2 transition-all duration-200',
                          isSelected
                            ? 'border-primary bg-gradient-to-r from-primary/10 to-purple-500/10 shadow-md ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dept.color || '#8B5CF6' }}
                          />
                          <span className={cn(
                            'text-sm font-medium truncate',
                            isSelected ? 'text-primary' : 'text-foreground'
                          )}>
                            {dept.name}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {usersCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Usuários (apenas para transferência para atendente) */}
            {transferType === 'user' && selectedDepartmentId && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User size={14} className="text-primary" />
                  Atendente
                  <span className="text-xs font-normal text-muted-foreground">
                    ({teamInDepartment.length} disponíve{teamInDepartment.length !== 1 ? 'is' : 'l'})
                  </span>
                </Label>
                {teamInDepartment.length === 0 ? (
                  <div className="flex items-center justify-center py-4 text-center">
                    <User className="h-5 w-5 text-muted-foreground/50 mr-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum atendente neste departamento
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {teamInDepartment.map((member) => {
                      const isSelected = selectedUserId === member.id;
                      return (
                        <button
                          key={member.id}
                          onClick={() => setSelectedUserId(member.id)}
                          className={cn(
                            'relative flex items-center justify-between p-2.5 rounded-lg border-2 transition-all duration-200',
                            isSelected
                              ? 'border-primary bg-gradient-to-r from-primary/10 to-purple-500/10 shadow-md ring-2 ring-primary/20'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-7 w-7 border border-background flex-shrink-0">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className={cn(
                                'text-xs font-medium',
                                isSelected 
                                  ? 'bg-gradient-to-br from-primary to-purple-600 text-white' 
                                  : 'bg-muted'
                              )}>
                                {member.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className={cn(
                              'text-sm font-medium truncate',
                              isSelected ? 'text-primary' : 'text-foreground'
                            )}>
                              {member.full_name || 'Usuário'}
                            </span>
                          </div>
                          <span className={cn(
                            'text-xs flex-shrink-0 ml-2',
                            member.is_online ? 'text-green-500' : 'text-muted-foreground'
                          )}>
                            {member.is_online ? 'Online' : 'Offline'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Alerta de fila para transferência de departamento */}
            {transferType === 'department' && selectedDepartmentId && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <Users size={18} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  A conversa irá para a aba "Pendentes" de <strong>{selectedDepartment?.name}</strong>
                </p>
              </div>
            )}

            {/* Opção de desafixar */}
            {isConversationPinned && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <Checkbox
                  id="unpin-conversation"
                  checked={shouldUnpin}
                  onCheckedChange={(checked) => setShouldUnpin(checked === true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="unpin-conversation" 
                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    <PinOff size={14} className="text-amber-500" />
                    Desafixar esta conversa
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Remover da sua aba "Fixadas" após a transferência
                  </p>
                </div>
              </div>
            )}

            {/* Nota de transferência */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Observação <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Descreva o motivo da transferência..."
                className="resize-none border-2 focus:border-primary focus:ring-primary/20"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/50 gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1 sm:flex-none">
            {userCanTransfer ? 'Cancelar' : 'Fechar'}
          </Button>
          {userCanTransfer && (
            <Button
              onClick={handleTransfer}
              disabled={
                transferConversation.isPending || 
                !selectedDepartmentId || 
                (transferType === 'user' && !selectedUserId)
              }
              className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 gap-2"
            >
              {transferConversation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Transferindo...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={16} />
                  Transferir
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}