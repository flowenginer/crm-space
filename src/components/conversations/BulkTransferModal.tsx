import { useState, useMemo, useEffect } from 'react';
import { ArrowRightLeft, Building2, User, Loader2, Users, Check, PauseCircle, Shuffle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useAllUserDepartments } from '@/hooks/useUserDepartments';
import { useBulkTransfer, useBulkDistribute } from '@/hooks/useBulkConversationActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface BulkTransferModalProps {
  open: boolean;
  onClose: () => void;
  onTransferSuccess?: () => void;
  conversationIds: string[];
}

type TransferMode = 'single' | 'distribute';
type TransferType = 'user' | 'department';

export function BulkTransferModal({
  open,
  onClose,
  onTransferSuccess,
  conversationIds,
}: BulkTransferModalProps) {
  const [transferMode, setTransferMode] = useState<TransferMode>('single');
  const [transferType, setTransferType] = useState<TransferType>('user');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const { data: departments = [], isLoading: isDepartmentsLoading } = useDepartments();
  const { data: team = [], isLoading: isTeamLoading } = useTeam();
  const { data: allUserDepartments = [], isLoading: isUserDepartmentsLoading } = useAllUserDepartments();
  const bulkTransfer = useBulkTransfer();
  const bulkDistribute = useBulkDistribute();

  const activeDepartments = departments.filter(d => d.is_active);

  useEffect(() => {
    setSelectedUserId('');
    setSelectedUserIds(new Set());
  }, [selectedDepartmentId, transferType, transferMode]);

  // Filter only AVAILABLE users
  const teamInDepartment = useMemo(() => {
    if (!selectedDepartmentId) return [];
    
    const usersInDepartment = allUserDepartments
      .filter(ud => ud.department_id === selectedDepartmentId)
      .map(ud => ud.user_id);
    
    return team.filter(member => 
      (usersInDepartment.includes(member.id) || member.department_id === selectedDepartmentId) &&
      member.is_available !== false
    );
  }, [team, selectedDepartmentId, allUserDepartments]);

  const pausedUsersInDepartment = useMemo(() => {
    if (!selectedDepartmentId) return [];
    
    const usersInDepartment = allUserDepartments
      .filter(ud => ud.department_id === selectedDepartmentId)
      .map(ud => ud.user_id);
    
    return team.filter(member => 
      (usersInDepartment.includes(member.id) || member.department_id === selectedDepartmentId) &&
      member.is_available === false
    );
  }, [team, selectedDepartmentId, allUserDepartments]);

  // Calculate distribution preview
  const distributionPreview = useMemo(() => {
    if (transferMode !== 'distribute' || selectedUserIds.size === 0) return null;
    
    const total = conversationIds.length;
    const numUsers = selectedUserIds.size;
    const base = Math.floor(total / numUsers);
    const remainder = total % numUsers;
    
    return {
      total,
      numUsers,
      base,
      remainder,
      perUser: Array.from(selectedUserIds).map((userId, index) => ({
        userId,
        userName: team.find(t => t.id === userId)?.full_name || 'Usuário',
        count: base + (index < remainder ? 1 : 0),
      })),
    };
  }, [transferMode, selectedUserIds, conversationIds.length, team]);

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleTransfer = async () => {
    if (!selectedDepartmentId) {
      toast.error('Selecione um departamento');
      return;
    }

    if (transferMode === 'single') {
      if (transferType === 'user' && !selectedUserId) {
        toast.error('Selecione um atendente');
        return;
      }
    } else {
      if (selectedUserIds.size < 2) {
        toast.error('Selecione pelo menos 2 vendedores para distribuição');
        return;
      }
    }

    const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
    const selectedUser = transferType === 'user' ? team.find(t => t.id === selectedUserId) : null;

    setIsTransferring(true);
    setProgress({ processed: 0, total: conversationIds.length });

    try {
      if (transferMode === 'single') {
        const result = await bulkTransfer.mutateAsync({
          conversationIds,
          toDepartmentId: selectedDepartmentId,
          toUserId: transferType === 'user' ? selectedUserId : null,
          note: note.trim() || undefined,
          onProgress: (processed, total) => {
            setProgress({ processed, total });
          },
        });

        const destination = transferType === 'department' 
          ? `fila de ${selectedDepartment?.name || 'departamento'}`
          : selectedUser?.full_name || 'atendente';

        if (result.success > 0 && result.failed === 0) {
          toast.success(`${result.success} conversa(s) transferida(s) para ${destination}`);
        } else if (result.success > 0 && result.failed > 0) {
          toast.warning(`${result.success} transferida(s), ${result.failed} falhou(aram)`);
        } else {
          toast.error('Falha ao transferir conversas');
        }
      } else {
        // Distribution mode
        const targetUserNames: Record<string, string> = {};
        team.forEach(t => {
          targetUserNames[t.id] = t.full_name || 'Usuário';
        });

        const result = await bulkDistribute.mutateAsync({
          conversationIds,
          targetUserIds: Array.from(selectedUserIds),
          targetUserNames,
          departmentId: selectedDepartmentId,
          note: note.trim() || 'Distribuição em massa',
          onProgress: (processed, total) => {
            setProgress({ processed, total });
          },
        });

        if (result.success > 0 && result.failed === 0) {
          const distDetails = result.distributions
            .map(d => `${d.userName} (${d.count})`)
            .join(', ');
          toast.success(`${result.success} conversas distribuídas`, {
            description: distDetails,
          });
        } else if (result.success > 0 && result.failed > 0) {
          toast.warning(`${result.success} distribuídas, ${result.failed} falha(s)`);
        } else {
          toast.error('Falha na distribuição');
        }
      }
      
      if (onTransferSuccess) {
        onTransferSuccess();
      }
      
      handleClose();
    } catch (error: any) {
      console.error('[BulkTransferModal] Error:', error);
      toast.error('Erro ao transferir conversas', {
        description: error?.message || 'Tente novamente.',
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleClose = () => {
    if (isTransferring) return;
    setTransferMode('single');
    setTransferType('user');
    setSelectedDepartmentId('');
    setSelectedUserId('');
    setSelectedUserIds(new Set());
    setNote('');
    setProgress({ processed: 0, total: 0 });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <ArrowRightLeft className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Transferir em Lote</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {conversationIds.length} conversa(s) selecionada(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        {isTransferring ? (
          <div className="p-8 space-y-4">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-semibold text-foreground">
                  {transferMode === 'distribute' ? 'Distribuindo conversas...' : 'Transferindo conversas...'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Processando {progress.processed} de {progress.total}
                </p>
              </div>
            </div>
            <Progress value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} className="h-2" />
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5">
              {/* Transfer Mode */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Modo de transferência</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTransferMode('single')}
                    className={cn(
                      'relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
                      transferMode === 'single' 
                        ? 'border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/10' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    {transferMode === 'single' && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      transferMode === 'single' 
                        ? 'bg-gradient-to-br from-primary to-purple-600 text-white' 
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <User size={16} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        transferMode === 'single' ? 'text-primary' : 'text-foreground'
                      )}>
                        Vendedor único
                      </p>
                      <p className="text-xs text-muted-foreground">Transferir para um</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setTransferMode('distribute');
                      setTransferType('user');
                    }}
                    className={cn(
                      'relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
                      transferMode === 'distribute' 
                        ? 'border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-lg shadow-primary/10' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    {transferMode === 'distribute' && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                      transferMode === 'distribute' 
                        ? 'bg-gradient-to-br from-primary to-purple-600 text-white' 
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <Shuffle size={16} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        transferMode === 'distribute' ? 'text-primary' : 'text-foreground'
                      )}>
                        Distribuir
                      </p>
                      <p className="text-xs text-muted-foreground">Dividir igualmente</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Transfer Type (only for single mode) */}
              {transferMode === 'single' && (
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
              )}

              {/* Departments */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 size={14} className="text-primary" />
                  Departamento
                </Label>
                {isDepartmentsLoading || isUserDepartmentsLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-11 rounded-lg" />
                    ))}
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

              {/* Users - Single Mode */}
              {transferMode === 'single' && transferType === 'user' && selectedDepartmentId && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User size={14} className="text-primary" />
                    Atendente
                    <span className="text-xs font-normal text-muted-foreground">
                      ({teamInDepartment.length} disponíve{teamInDepartment.length !== 1 ? 'is' : 'l'})
                    </span>
                    {pausedUsersInDepartment.length > 0 && (
                      <span className="text-xs font-normal text-amber-500 flex items-center gap-1">
                        <PauseCircle size={12} />
                        {pausedUsersInDepartment.length} pausado{pausedUsersInDepartment.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </Label>
                  {isTeamLoading ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-12 rounded-lg" />
                      ))}
                    </div>
                  ) : teamInDepartment.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {pausedUsersInDepartment.length > 0 
                          ? 'Todos os atendentes estão com recebimento pausado'
                          : 'Nenhum atendente neste departamento'}
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
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Users - Distribute Mode (Multi-select) */}
              {transferMode === 'distribute' && selectedDepartmentId && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users size={14} className="text-primary" />
                    Vendedores destino
                    <span className="text-xs font-normal text-muted-foreground">
                      (selecione 2 ou mais)
                    </span>
                  </Label>
                  {isTeamLoading ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-12 rounded-lg" />
                      ))}
                    </div>
                  ) : teamInDepartment.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum atendente disponível neste departamento
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {teamInDepartment.map((member) => {
                        const isSelected = selectedUserIds.has(member.id);
                        const preview = distributionPreview?.perUser.find(p => p.userId === member.id);
                        return (
                          <button
                            key={member.id}
                            onClick={() => toggleUserSelection(member.id)}
                            className={cn(
                              'relative flex items-center justify-between p-2.5 rounded-lg border-2 transition-all duration-200',
                              isSelected
                                ? 'border-primary bg-gradient-to-r from-primary/10 to-purple-500/10 shadow-md ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox 
                                checked={isSelected} 
                                className="pointer-events-none"
                              />
                              <Avatar className="h-6 w-6 border border-background flex-shrink-0">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback className="text-xs bg-muted">
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
                            {preview && (
                              <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {preview.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Distribution Preview */}
                  {distributionPreview && distributionPreview.numUsers >= 2 && (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-sm text-primary font-medium">
                        📊 Prévia: {distributionPreview.total} conversas ÷ {distributionPreview.numUsers} vendedores
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {distributionPreview.remainder > 0 
                          ? `${distributionPreview.base} para cada + ${distributionPreview.remainder} extra(s) distribuído(s) aleatoriamente`
                          : `${distributionPreview.base} para cada vendedor`
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Note */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Observação (opcional)
                </Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Adicione uma observação para a transferência..."
                  className="resize-none h-20"
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="p-4 border-t border-border/50 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isTransferring}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={
              isTransferring || 
              !selectedDepartmentId || 
              (transferMode === 'single' && transferType === 'user' && !selectedUserId) ||
              (transferMode === 'distribute' && selectedUserIds.size < 2)
            }
            className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          >
            {isTransferring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {transferMode === 'distribute' ? 'Distribuindo...' : 'Transferindo...'}
              </>
            ) : (
              <>
                {transferMode === 'distribute' ? (
                  <Shuffle className="h-4 w-4 mr-2" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                )}
                {transferMode === 'distribute' 
                  ? `Distribuir ${conversationIds.length}` 
                  : `Transferir ${conversationIds.length}`
                }
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
