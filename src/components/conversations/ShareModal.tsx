import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Share2, Loader2, Users, Building2, X, Link2 } from 'lucide-react';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useAllUserDepartments } from '@/hooks/useUserDepartments';
import { useShareConversation, useMySharesForConversation, useRemoveShare } from '@/hooks/useSharedConversations';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  conversationId: string;
  contactName?: string;
  conversationOwnerId?: string | null;
}

type ShareType = 'user' | 'department';

export function ShareModal({ open, onClose, onSuccess, conversationId, contactName, conversationOwnerId }: ShareModalProps) {
  const [shareType, setShareType] = useState<ShareType>('user');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [shareWithEntireDepartment, setShareWithEntireDepartment] = useState(false);
  const [note, setNote] = useState('');

  const { data: departments = [] } = useDepartments();
  const { data: teamMembers = [] } = useTeam();
  const { data: userDepartments = [] } = useAllUserDepartments();
  const { data: existingShares = [], isLoading: loadingShares } = useMySharesForConversation(conversationId);
  const shareMutation = useShareConversation();
  const removeShareMutation = useRemoveShare();

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
      // Reset form but keep modal open to allow more shares
      setSelectedUserId('');
      setNote('');
      onSuccess?.();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Esta conversa já foi compartilhada com este destino');
      } else if (error.message?.includes('responsável')) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao compartilhar conversa');
      }
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      await removeShareMutation.mutateAsync(shareId);
      toast.success('Compartilhamento removido');
    } catch (error) {
      toast.error('Erro ao remover compartilhamento');
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
          {/* Existing Shares Section */}
          {existingShares.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Link2 className="h-4 w-4 text-primary" />
                Compartilhado com:
              </div>
              <div className="space-y-2">
                {existingShares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 bg-background rounded-md border border-border"
                  >
                    <div className="flex items-center gap-2">
                      {share.shared_with_profile ? (
                        <>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={share.shared_with_profile.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {share.shared_with_profile.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{share.shared_with_profile.full_name}</span>
                        </>
                      ) : share.department ? (
                        <>
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm">{share.department.name} (departamento)</span>
                        </>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveShare(share.id)}
                      disabled={removeShareMutation.isPending}
                    >
                      {removeShareMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            Fechar
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
