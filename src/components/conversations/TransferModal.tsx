import { useState } from 'react';
import { ArrowRightLeft, Building2, User, Loader2 } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useTransferConversation } from '@/hooks/useConversationEvents';
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
  const [transferType, setTransferType] = useState<'department' | 'user'>('department');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [note, setNote] = useState('');

  const { data: departments = [] } = useDepartments();
  const { data: team = [] } = useTeam();
  const transferConversation = useTransferConversation();

  const activeDepartments = departments.filter(d => d.is_active);
  const activeTeam = team.filter(t => t.id !== currentAssignedTo);

  const handleTransfer = async () => {
    if (transferType === 'department' && !selectedDepartmentId) {
      toast.error('Selecione um departamento');
      return;
    }

    if (transferType === 'user' && !selectedUserId) {
      toast.error('Selecione um atendente');
      return;
    }

    const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
    const selectedUser = team.find(t => t.id === selectedUserId);

    try {
      await transferConversation.mutateAsync({
        conversationId,
        toUserId: transferType === 'user' ? selectedUserId : null,
        toUserName: selectedUser?.full_name || null,
        toDepartmentId: transferType === 'department' ? selectedDepartmentId : null,
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
    setTransferType('department');
    setSelectedDepartmentId('');
    setSelectedUserId('');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-blue-500" />
            Transferir Conversa
          </DialogTitle>
          <DialogDescription>
            Escolha para onde deseja transferir esta conversa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transfer Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Transferir para:</Label>
            <RadioGroup
              value={transferType}
              onValueChange={(value) => setTransferType(value as 'department' | 'user')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="department" id="department" />
                <Label htmlFor="department" className="flex items-center gap-1.5 cursor-pointer">
                  <Building2 size={14} />
                  Departamento
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="user" id="user" />
                <Label htmlFor="user" className="flex items-center gap-1.5 cursor-pointer">
                  <User size={14} />
                  Atendente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Department Selection */}
          {transferType === 'department' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selecione o departamento</Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um departamento..." />
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
          )}

          {/* User Selection */}
          {transferType === 'user' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selecione o atendente</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um atendente..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTeam.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum atendente disponível
                    </SelectItem>
                  ) : (
                    activeTeam.map((member) => (
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={transferConversation.isPending}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
