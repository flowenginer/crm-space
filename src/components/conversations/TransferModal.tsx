import { useState, useMemo, useEffect } from 'react';
import { ArrowRightLeft, Building2, User, Loader2, ShieldAlert, ChevronRight, Users, Pin, PinOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useAllUserDepartments } from '@/hooks/useUserDepartments';
import { useTransferConversation } from '@/hooks/useConversationEvents';
import { usePinnedConversations, useUnpinConversation } from '@/hooks/usePinnedConversations';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

  const { data: departments = [], isLoading: isDepartmentsLoading, isError: isDepartmentsError, refetch: refetchDepartments } = useDepartments();
  const { data: team = [] } = useTeam();
  const { data: allUserDepartments = [] } = useAllUserDepartments();
  const { data: pinnedConversations = [] } = usePinnedConversations();
  const unpinConversation = useUnpinConversation();
  const transferConversation = useTransferConversation();
  const { can } = usePermissions();
  const { user } = useAuth();

  // Check if this conversation is pinned by the current user
  const isConversationPinned = pinnedConversations.some(p => p.conversation_id === conversationId);

  const activeDepartments = departments.filter(d => d.is_active);

  // Reset userId when department changes or transfer type changes
  useEffect(() => {
    setSelectedUserId('');
  }, [selectedDepartmentId, transferType]);

  // Filter team members that belong to the selected department
  const teamInDepartment = useMemo(() => {
    if (!selectedDepartmentId) return [];
    
    // Get users who have this department in user_departments table
    const usersInDepartment = allUserDepartments
      .filter(ud => ud.department_id === selectedDepartmentId)
      .map(ud => ud.user_id);
    
    // Also include users whose primary department_id matches
    return team.filter(member => 
      member.id !== currentAssignedTo && // Exclude current assignee
      (
        usersInDepartment.includes(member.id) || 
        member.department_id === selectedDepartmentId
      )
    );
  }, [team, selectedDepartmentId, allUserDepartments, currentAssignedTo]);

  // Check if user can transfer this conversation
  const canTransfer = (): boolean => {
    // Any user with transfer permission can transfer any conversation
    return can.transferConversations();
  };

  const handleTransfer = async () => {
    // Permission check before transfer
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

    // For user transfer, require user selection
    if (transferType === 'user' && !selectedUserId) {
      toast.error('Selecione um atendente');
      return;
    }

    const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
    const selectedUser = transferType === 'user' ? team.find(t => t.id === selectedUserId) : null;

    try {
      // If conversation is pinned and user wants to unpin, do it first
      if (isConversationPinned && shouldUnpin) {
        await unpinConversation.mutateAsync(conversationId);
      }

      await transferConversation.mutateAsync({
        conversationId,
        // For department transfer, toUserId is null (goes to pending queue)
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
      
      // Navigate away BEFORE closing the modal
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-blue-500" />
            Transferir Conversa
          </DialogTitle>
          <DialogDescription>
            Selecione o departamento e o atendente para transferir
          </DialogDescription>
        </DialogHeader>

        {!userCanTransfer ? (
          <div className="py-6">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="text-destructive" size={24} />
              </div>
              <div>
                <p className="font-medium text-foreground">Sem permissão</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Você não pode transferir esta conversa pois ela pertence a outro atendente.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Transfer Type Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de transferência</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTransferType('user')}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                    transferType === 'user' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <User size={18} className={transferType === 'user' ? 'text-primary' : 'text-muted-foreground'} />
                  <div className="text-left">
                    <p className={cn('text-sm font-medium', transferType === 'user' ? 'text-primary' : 'text-foreground')}>
                      Para atendente
                    </p>
                    <p className="text-xs text-muted-foreground">Atribuição direta</p>
                  </div>
                </button>
                <button
                  onClick={() => setTransferType('department')}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                    transferType === 'department' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <Users size={18} className={transferType === 'department' ? 'text-primary' : 'text-muted-foreground'} />
                  <div className="text-left">
                    <p className={cn('text-sm font-medium', transferType === 'department' ? 'text-primary' : 'text-foreground')}>
                      Para fila
                    </p>
                    <p className="text-xs text-muted-foreground">Aba "Pendentes"</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <div className={`flex items-center gap-1.5 ${selectedDepartmentId ? 'text-primary' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${selectedDepartmentId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  1
                </div>
                <span>Departamento</span>
              </div>
              {transferType === 'user' && (
                <>
                  <ChevronRight size={16} />
                  <div className={`flex items-center gap-1.5 ${selectedUserId ? 'text-primary' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${selectedUserId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      2
                    </div>
                    <span>Atendente</span>
                  </div>
                </>
              )}
            </div>

            {/* Step 1: Department Selection (Required) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 size={14} />
                Departamento <span className="text-destructive">*</span>
              </Label>
            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger disabled={isDepartmentsLoading}>
                  <SelectValue placeholder={isDepartmentsLoading ? "Carregando..." : "Selecione o departamento..."} />
                </SelectTrigger>
                <SelectContent>
                  {isDepartmentsLoading ? (
                    <div className="flex items-center justify-center py-4 gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm text-muted-foreground">Carregando departamentos...</span>
                    </div>
                  ) : isDepartmentsError ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                      <span className="text-sm text-destructive">Erro ao carregar departamentos</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => refetchDepartments()}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  ) : activeDepartments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                      <span className="text-sm text-muted-foreground">Nenhum departamento disponível</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => refetchDepartments()}
                      >
                        Recarregar
                      </Button>
                    </div>
                  ) : (
                    activeDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: dept.color || '#8B5CF6' }}
                          />
                          {dept.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {transferType === 'department' && selectedDepartmentId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users size={12} />
                  A conversa irá para a aba "Pendentes" do departamento selecionado
                </p>
              )}
            </div>

            {/* Step 2: User Selection (Only for user transfer type) */}
            {transferType === 'user' && selectedDepartmentId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <User size={14} />
                  Atendente <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o atendente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamInDepartment.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhum atendente neste departamento
                      </SelectItem>
                    ) : (
                      teamInDepartment.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                              {member.full_name?.charAt(0) || 'U'}
                            </div>
                            <span>{member.full_name || 'Usuário'}</span>
                            {member.is_online && (
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {teamInDepartment.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Não há atendentes cadastrados neste departamento.
                  </p>
                )}
              </div>
            )}

            {/* Unpin option - only show if conversation is pinned */}
            {isConversationPinned && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
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
                    A conversa está fixada. Se marcado, ela será removida da sua aba "Fixadas" após a transferência.
                  </p>
                </div>
              </div>
            )}

            {/* Transfer Note */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo da transferência (opcional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explique o motivo da transferência..."
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
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
              className="gap-2"
            >
              {transferConversation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Transferindo...
                </>
              ) : (
                <>
                  {transferType === 'department' ? <Users size={14} /> : <ArrowRightLeft size={14} />}
                  {transferType === 'department' ? 'Enviar para fila' : 'Transferir'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
