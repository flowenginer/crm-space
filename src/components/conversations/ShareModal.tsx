import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Share2, Loader2, Users, Building2, X, Link2, Eye, Pencil, Check, Circle } from 'lucide-react';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useAllUserDepartments } from '@/hooks/useUserDepartments';
import { useShareConversation, useMySharesForConversation, useRemoveShare, type PermissionLevel } from '@/hooks/useSharedConversations';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('view');

  const { data: departments = [] } = useDepartments();
  const { data: teamMembers = [] } = useTeam();
  const { data: userDepartments = [] } = useAllUserDepartments();
  const { data: existingShares = [], isLoading: loadingShares } = useMySharesForConversation(conversationId);
  const shareMutation = useShareConversation();
  const removeShareMutation = useRemoveShare();

  const activeDepartments = departments.filter(d => d.is_active);

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
          permissionLevel,
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
          permissionLevel,
        });
      }

      toast.success('Conversa compartilhada com sucesso!');
      setSelectedUserId('');
      setNote('');
      setPermissionLevel('view');
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
    setPermissionLevel('view');
    onClose();
  };

  const canShare = shareType === 'department' || shareWithEntireDepartment
    ? !!selectedDepartmentId
    : !!selectedUserId;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh]">
        {/* Header com gradiente */}
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/5 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Share2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Compartilhar Conversa</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {contactName 
                  ? `Compartilhar conversa com ${contactName}` 
                  : 'Compartilhe com sua equipe'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="p-6 space-y-5">
            {/* Compartilhamentos existentes */}
            {existingShares.length > 0 && (
              <div className="space-y-3 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl border border-border">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Link2 className="h-4 w-4 text-primary" />
                  Compartilhado com ({existingShares.length})
                </div>
                <div className="space-y-2">
                  {existingShares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 bg-background rounded-lg border border-border shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {share.shared_with_profile ? (
                          <>
                            <Avatar className="h-9 w-9 border-2 border-primary/20">
                              <AvatarImage src={share.shared_with_profile.avatar_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary text-xs font-medium">
                                {share.shared_with_profile.full_name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{share.shared_with_profile.full_name}</p>
                              <p className="text-xs text-muted-foreground">Usuário</p>
                            </div>
                          </>
                        ) : share.department ? (
                          <>
                            <div 
                              className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10"
                            >
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{share.department.name}</p>
                              <p className="text-xs text-muted-foreground">Departamento</p>
                            </div>
                          </>
                        ) : null}
                        <Badge 
                          className={cn(
                            "text-[10px] px-2 py-0.5 font-medium",
                            share.permission_level === 'edit' 
                              ? 'bg-green-500/15 text-green-600 border-green-500/30' 
                              : 'bg-muted text-muted-foreground border-border'
                          )}
                        >
                          {share.permission_level === 'edit' ? (
                            <><Pencil className="h-2.5 w-2.5 mr-1" /> Editor</>
                          ) : (
                            <><Eye className="h-2.5 w-2.5 mr-1" /> Visualização</>
                          )}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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

            {/* Tipo de Compartilhamento */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">Tipo de compartilhamento</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShareType('user');
                    setShareWithEntireDepartment(false);
                  }}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                    shareType === 'user' 
                      ? 'border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/10' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {shareType === 'user' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    shareType === 'user' 
                      ? 'bg-gradient-to-br from-primary to-purple-600 text-white' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <Users size={20} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      shareType === 'user' ? 'text-primary' : 'text-foreground'
                    )}>
                      Com usuário
                    </p>
                    <p className="text-xs text-muted-foreground">Pessoa específica</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShareType('department');
                    setSelectedUserId('');
                  }}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                    shareType === 'department' 
                      ? 'border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/10' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {shareType === 'department' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    shareType === 'department' 
                      ? 'bg-gradient-to-br from-primary to-purple-600 text-white' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <Building2 size={20} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      shareType === 'department' ? 'text-primary' : 'text-foreground'
                    )}>
                      Com departamento
                    </p>
                    <p className="text-xs text-muted-foreground">Equipe inteira</p>
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
              <ScrollArea className="h-[120px]">
                <div className="grid grid-cols-2 gap-2 pr-3">
                  {activeDepartments.map((dept) => {
                    const usersCount = userDepartments.filter(ud => ud.department_id === dept.id).length;
                    const isSelected = selectedDepartmentId === dept.id;
                    return (
                      <button
                        key={dept.id}
                        onClick={() => {
                          setSelectedDepartmentId(dept.id);
                          setSelectedUserId('');
                        }}
                        className={cn(
                          'relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 text-left',
                          isSelected
                            ? 'border-primary bg-gradient-to-r from-primary/10 to-purple-500/10 shadow-md ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                        <div 
                          className="w-3 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dept.color || '#8B5CF6' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'text-sm font-medium truncate',
                            isSelected ? 'text-primary' : 'text-foreground'
                          )}>
                            {dept.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {usersCount} usuário{usersCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Checkbox para compartilhar com todo departamento (apenas se tipo for usuário) */}
            {shareType === 'user' && selectedDepartmentId && (
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 border border-border">
                <Checkbox
                  id="share-all-dept"
                  checked={shareWithEntireDepartment}
                  onCheckedChange={(checked) => {
                    setShareWithEntireDepartment(!!checked);
                    if (checked) setSelectedUserId('');
                  }}
                />
                <Label htmlFor="share-all-dept" className="text-sm cursor-pointer">
                  Compartilhar com <strong>todo o departamento</strong> selecionado
                </Label>
              </div>
            )}

            {/* Usuários (apenas para compartilhamento com usuário e sem checkbox marcado) */}
            {shareType === 'user' && selectedDepartmentId && !shareWithEntireDepartment && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users size={14} className="text-primary" />
                  Usuário
                  <span className="text-xs font-normal text-muted-foreground">
                    ({teamInDepartment.length} disponíve{teamInDepartment.length !== 1 ? 'is' : 'l'})
                  </span>
                </Label>
                <ScrollArea className="h-[120px]">
                  {teamInDepartment.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum usuário neste departamento
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pr-3">
                      {teamInDepartment.map((member) => {
                        const isSelected = selectedUserId === member.id;
                        return (
                          <button
                            key={member.id}
                            onClick={() => setSelectedUserId(member.id)}
                            className={cn(
                              'relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 text-left',
                              isSelected
                                ? 'border-primary bg-gradient-to-r from-primary/10 to-purple-500/10 shadow-md ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            )}
                          >
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                            <div className="relative">
                              <Avatar className="h-9 w-9 border-2 border-background">
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
                              {member.is_online && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background">
                                  <Circle className="h-full w-full animate-pulse text-green-300 fill-current" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                'text-sm font-medium truncate',
                                isSelected ? 'text-primary' : 'text-foreground'
                              )}>
                                {member.full_name || 'Usuário'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.is_online ? (
                                  <span className="text-green-500">Online</span>
                                ) : (
                                  <span>Offline</span>
                                )}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Nível de Permissão */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">Nível de acesso</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPermissionLevel('view')}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                    permissionLevel === 'view' 
                      ? 'border-muted-foreground/50 bg-muted/50 shadow-md' 
                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                  )}
                >
                  {permissionLevel === 'view' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-muted-foreground flex items-center justify-center">
                      <Check className="h-3 w-3 text-background" />
                    </div>
                  )}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    permissionLevel === 'view' 
                      ? 'bg-muted-foreground text-background' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <Eye size={20} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      permissionLevel === 'view' ? 'text-foreground' : 'text-foreground'
                    )}>
                      Só visualizar
                    </p>
                    <p className="text-xs text-muted-foreground">Não pode responder</p>
                  </div>
                </button>
                <button
                  onClick={() => setPermissionLevel('edit')}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                    permissionLevel === 'edit' 
                      ? 'border-green-500 bg-green-500/10 shadow-md shadow-green-500/10' 
                      : 'border-border hover:border-green-500/50 hover:bg-green-500/5'
                  )}
                >
                  {permissionLevel === 'edit' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    permissionLevel === 'edit' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <Pencil size={20} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      permissionLevel === 'edit' ? 'text-green-600 dark:text-green-400' : 'text-foreground'
                    )}>
                      Conversar também
                    </p>
                    <p className="text-xs text-muted-foreground">Pode responder</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Nota */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Observação <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Adicione uma observação sobre o compartilhamento..."
                rows={2}
                className="resize-none border-2 focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/50 gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1 sm:flex-none">
            Fechar
          </Button>
          <Button
            onClick={handleShare}
            disabled={!canShare || shareMutation.isPending}
            className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 gap-2"
          >
            {shareMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Compartilhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}