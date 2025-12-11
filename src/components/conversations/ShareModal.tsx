import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Share2, Loader2, Users, Building2 } from 'lucide-react';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useAllUserDepartments } from '@/hooks/useUserDepartments';
import { useShareConversation } from '@/hooks/useSharedConversations';
import { toast } from 'sonner';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  conversationId: string;
  contactName?: string;
}

type ShareType = 'user' | 'department';

export function ShareModal({ open, onClose, onSuccess, conversationId, contactName }: ShareModalProps) {
  const [shareType, setShareType] = useState<ShareType>('user');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [shareWithEntireDepartment, setShareWithEntireDepartment] = useState(false);
  const [note, setNote] = useState('');

  const { data: departments = [] } = useDepartments();
  const { data: teamMembers = [] } = useTeam();
  const { data: userDepartments = [] } = useAllUserDepartments();
  const shareMutation = useShareConversation();

  // Filter team members by selected department
  const teamInDepartment = useMemo(() => {
    if (!selectedDepartmentId) return [];
    
    const memberIdsInDept = userDepartments
      .filter(ud => ud.department_id === selectedDepartmentId)
      .map(ud => ud.user_id);
    
    return teamMembers.filter(t => memberIdsInDept.includes(t.id));
  }, [selectedDepartmentId, userDepartments, teamMembers]);

  const handleShare = async () => {
    if (!conversationId) return;

    try {
      if (shareType === 'department' || shareWithEntireDepartment) {
        // Share with entire department
        if (!selectedDepartmentId) {
          toast.error('Selecione um departamento');
          return;
        }
        await shareMutation.mutateAsync({
          conversationId,
          departmentId: selectedDepartmentId,
          note: note.trim() || undefined,
        });
      } else {
        // Share with specific user
        if (!selectedUserId) {
          toast.error('Selecione um usuário');
          return;
        }
        await shareMutation.mutateAsync({
          conversationId,
          sharedWith: selectedUserId,
          note: note.trim() || undefined,
        });
      }

      toast.success('Conversa compartilhada com sucesso!');
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Esta conversa já foi compartilhada com este destino');
      } else {
        toast.error('Erro ao compartilhar conversa');
      }
    }
  };

  const handleClose = () => {
    setShareType('user');
    setSelectedDepartmentId('');
    setSelectedUserId('');
    setShareWithEntireDepartment(false);
    setNote('');
    onClose();
  };

  const canShare = shareType === 'department' || shareWithEntireDepartment
    ? !!selectedDepartmentId
    : !!selectedUserId;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Conversa
          </DialogTitle>
          <DialogDescription>
            {contactName 
              ? `Compartilhar a conversa com ${contactName}` 
              : 'Compartilhe esta conversa com outros membros da equipe'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Share Type Selection */}
          <div className="space-y-2">
            <Label>Tipo de compartilhamento</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={shareType === 'user' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShareType('user');
                  setShareWithEntireDepartment(false);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Com usuário
              </Button>
              <Button
                type="button"
                variant={shareType === 'department' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShareType('department');
                  setSelectedUserId('');
                }}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Com departamento
              </Button>
            </div>
          </div>

          {/* Department Selection */}
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={selectedDepartmentId} onValueChange={(v) => {
              setSelectedDepartmentId(v);
              setSelectedUserId('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {departments.filter(d => d.is_active).map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Selection (only for 'user' type) */}
          {shareType === 'user' && selectedDepartmentId && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="share-all-dept"
                  checked={shareWithEntireDepartment}
                  onCheckedChange={(checked) => {
                    setShareWithEntireDepartment(!!checked);
                    if (checked) setSelectedUserId('');
                  }}
                />
                <Label htmlFor="share-all-dept" className="text-sm">
                  Compartilhar com todo o departamento
                </Label>
              </div>

              {!shareWithEntireDepartment && (
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamInDepartment.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum usuário neste departamento
                        </div>
                      ) : (
                        teamInDepartment.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Adicione uma observação sobre o compartilhamento..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleShare}
            disabled={!canShare || shareMutation.isPending}
          >
            {shareMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            Compartilhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
