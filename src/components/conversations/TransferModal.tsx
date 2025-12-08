import { useState, useMemo, useEffect } from 'react';
import { ArrowRightLeft, Building2, User, Loader2, ShieldAlert, ChevronRight } from 'lucide-react';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  currentAssignedTo?: string | null;
  currentDepartmentId?: string | null;
}

export function TransferModal({
  open,
  onClose,
  conversationId,
  currentAssignedTo,
  currentDepartmentId,
}: TransferModalProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [note, setNote] = useState('');

  const { data: departments = [] } = useDepartments();
  const { data: team = [] } = useTeam();
  const { data: allUserDepartments = [] } = useAllUserDepartments();
  const transferConversation = useTransferConversation();
  const { can } = usePermissions();
  const { user } = useAuth();

  const activeDepartments = departments.filter(d => d.is_active);

  // Reset userId when department changes
  useEffect(() => {
    setSelectedUserId('');
  }, [selectedDepartmentId]);

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
    // First check if user has transfer permission
    if (!can.transferConversations()) {
      return false;
    }
    
    // Admin/supervisor can transfer any conversation
    if (can.viewAllConversations()) {
      return true;
    }
    
    // Allow transferring orphan conversations (no owner)
    if (currentAssignedTo === null || currentAssignedTo === undefined) {
      return true;
    }
    
    // User can only transfer their own conversations
    return currentAssignedTo === user?.id;
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

    if (!selectedUserId) {
      toast.error('Selecione um atendente');
      return;
    }

    const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
    const selectedUser = team.find(t => t.id === selectedUserId);

    try {
      await transferConversation.mutateAsync({
        conversationId,
        toUserId: selectedUserId,
        toUserName: selectedUser?.full_name || null,
        toDepartmentId: selectedDepartmentId,
        toDepartmentName: selectedDepartment?.name || null,
        note: note.trim() || undefined,
      });

      toast.success('Conversa transferida com sucesso');
      handleClose();
    } catch (error) {
      console.error('Error transferring conversation:', error);
      toast.error('Erro ao transferir conversa');
    }
  };

  const handleClose = () => {
    setSelectedDepartmentId('');
    setSelectedUserId('');
    setNote('');
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
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <div className={`flex items-center gap-1.5 ${selectedDepartmentId ? 'text-primary' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${selectedDepartmentId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  1
                </div>
                <span>Departamento</span>
              </div>
              <ChevronRight size={16} />
              <div className={`flex items-center gap-1.5 ${selectedUserId ? 'text-primary' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${selectedUserId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  2
                </div>
                <span>Atendente</span>
              </div>
            </div>

            {/* Step 1: Department Selection (Required) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 size={14} />
                Departamento <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento..." />
                </SelectTrigger>
                <SelectContent>
                  {activeDepartments.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum departamento disponível
                    </SelectItem>
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
            </div>

            {/* Step 2: User Selection (Required, only appears after department is selected) */}
            {selectedDepartmentId && (
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
              disabled={transferConversation.isPending || !selectedDepartmentId || !selectedUserId}
              className="gap-2"
            >
              {transferConversation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Transferindo...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={14} />
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
