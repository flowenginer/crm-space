import { useState } from 'react';
import { Plus, Trash2, Users, Package, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useTeam } from '@/hooks/useTeam';
import {
  useAllSharedBoxes,
  useSharedBoxMembers,
  useAddSharedBoxMember,
  useRemoveSharedBoxMember
} from '@/hooks/useSharedEmailBoxes';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function SharedBoxManagement() {
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isCreateBoxOpen, setIsCreateBoxOpen] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxDescription, setNewBoxDescription] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<{ boxId: string; userId: string; userName: string } | null>(null);

  const { data: sharedBoxes, isLoading: loadingBoxes } = useAllSharedBoxes();
  const { data: members, isLoading: loadingMembers } = useSharedBoxMembers(selectedBoxId);
  const { data: team } = useTeam();
  const addMember = useAddSharedBoxMember();
  const removeMember = useRemoveSharedBoxMember();
  const queryClient = useQueryClient();

  // Mutation para criar nova caixa
  const createBox = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from('email_shared_boxes')
        .insert({
          name,
          description: description || null,
          distribution_type: 'claim'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-shared-boxes'] });
      toast.success('Caixa compartilhada criada');
      setIsCreateBoxOpen(false);
      setNewBoxName('');
      setNewBoxDescription('');
    },
    onError: () => {
      toast.error('Erro ao criar caixa compartilhada');
    }
  });

  // Membros disponíveis (não estão na caixa selecionada)
  const availableMembers = team?.filter(
    t => !members?.find(m => m.user_id === t.id)
  ) || [];

  const handleAddMember = async (userId: string) => {
    if (!selectedBoxId) return;
    
    try {
      await addMember.mutateAsync({ sharedBoxId: selectedBoxId, userId });
      toast.success('Membro adicionado');
      setIsAddMemberOpen(false);
    } catch {
      toast.error('Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    
    try {
      await removeMember.mutateAsync({ 
        sharedBoxId: memberToRemove.boxId, 
        userId: memberToRemove.userId 
      });
      toast.success('Membro removido');
      setMemberToRemove(null);
    } catch {
      toast.error('Erro ao remover membro');
    }
  };

  const selectedBox = sharedBoxes?.find(b => b.id === selectedBoxId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Caixas de E-mail Compartilhadas
        </CardTitle>
        <CardDescription>
          Gerencie caixas compartilhadas e seus membros. E-mails enviados para essas caixas podem ser assumidos por qualquer membro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seletor de caixa + botão criar */}
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label>Selecionar Caixa</Label>
            <Select value={selectedBoxId || ''} onValueChange={setSelectedBoxId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma caixa compartilhada" />
              </SelectTrigger>
              <SelectContent>
                {loadingBoxes ? (
                  <div className="p-2 text-center text-muted-foreground">Carregando...</div>
                ) : sharedBoxes?.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground">Nenhuma caixa criada</div>
                ) : (
                  sharedBoxes?.map(box => (
                    <SelectItem key={box.id} value={box.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {box.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setIsCreateBoxOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Caixa
          </Button>
        </div>

        {/* Membros da caixa selecionada */}
        {selectedBoxId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Membros de "{selectedBox?.name}"
              </h3>
              <Button size="sm" onClick={() => setIsAddMemberOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Membro
              </Button>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members?.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">
                Nenhum membro adicionado. Adicione membros para que eles possam ver e assumir e-mails desta caixa.
              </div>
            ) : (
              <div className="grid gap-2">
                {members?.map(member => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.user?.avatar_url || undefined} />
                        <AvatarFallback>
                          {member.user ? getInitials(member.user.full_name) : '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Adicionado em {new Date(member.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setMemberToRemove({
                        boxId: selectedBoxId,
                        userId: member.user_id,
                        userName: member.user?.full_name || 'Membro'
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Modal para adicionar membro */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
            <DialogDescription>
              Selecione um usuário para adicionar à caixa "{selectedBox?.name}"
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {availableMembers.length === 0 ? (
                <p className="text-center text-muted-foreground p-4">
                  Todos os usuários já são membros desta caixa
                </p>
              ) : (
                availableMembers.map(user => (
                  <Button
                    key={user.id}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleAddMember(user.id)}
                    disabled={addMember.isPending}
                  >
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p>{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal para criar caixa */}
      <Dialog open={isCreateBoxOpen} onOpenChange={setIsCreateBoxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Caixa Compartilhada</DialogTitle>
            <DialogDescription>
              Crie uma nova caixa de e-mail compartilhada para sua equipe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={newBoxName}
                onChange={e => setNewBoxName(e.target.value)}
                placeholder="Ex: Designers, Suporte, Financeiro"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={newBoxDescription}
                onChange={e => setNewBoxDescription(e.target.value)}
                placeholder="Descreva o propósito desta caixa"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateBoxOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createBox.mutate({ name: newBoxName, description: newBoxDescription })}
              disabled={!newBoxName.trim() || createBox.isPending}
            >
              {createBox.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {memberToRemove?.userName} desta caixa compartilhada?
              O usuário não poderá mais ver ou assumir e-mails desta caixa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}