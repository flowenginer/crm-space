import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSupportTechnicians, useAddTechnician, useRemoveTechnician, useIsSupportTechnician } from '@/hooks/useSupportTickets';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

export default function TechniciansManagement() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const { data: isTechnician, isLoading: checkingTechnician } = useIsSupportTechnician();
  const { data: technicians, isLoading } = useSupportTechnicians();
  const addTechnician = useAddTechnician();
  const removeTechnician = useRemoveTechnician();

  // Get all profiles to select from
  const { data: allProfiles } = useQuery({
    queryKey: ['all-profiles-for-technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
  });

  const isSuperAdmin = profile?.role === 'super_admin';
  const existingTechnicianIds = technicians?.map(t => t.user_id) || [];
  const availableProfiles = allProfiles?.filter(p => !existingTechnicianIds.includes(p.id)) || [];

  const handleAddTechnician = async () => {
    if (!selectedUserId) return;
    
    try {
      await addTechnician.mutateAsync({ userId: selectedUserId });
      setSelectedUserId('');
      setIsAddDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRemoveTechnician = async (technicianId: string) => {
    if (!confirm('Remover este técnico de suporte?')) return;
    
    try {
      await removeTechnician.mutateAsync(technicianId);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (checkingTechnician) {
    return (
      <div className="container mx-auto py-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!isTechnician && !isSuperAdmin) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Você não tem permissão para acessar esta página.
            </p>
            <Button onClick={() => navigate('/suporte')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Suporte
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/suporte')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Técnicos de Suporte
          </h1>
          <p className="text-muted-foreground">
            Gerencie quem pode atender tickets de suporte
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Técnicos</CardTitle>
              <CardDescription>
                Técnicos podem visualizar e gerenciar tickets de todos os tenants
              </CardDescription>
            </div>
            
            {isSuperAdmin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Técnico
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Técnico de Suporte</DialogTitle>
                    <DialogDescription>
                      Selecione um usuário para ser técnico de suporte. Ele poderá ver todos os tickets.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-4">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProfiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            <div className="flex items-center gap-2">
                              <span>{profile.full_name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {profile.role}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleAddTechnician}
                      disabled={!selectedUserId || addTechnician.isPending}
                    >
                      {addTechnician.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : technicians && technicians.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Especialidades</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead>Status</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {technicians.map((tech) => {
                  const initials = tech.profile?.full_name
                    ?.split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase() || '?';
                  
                  return (
                    <TableRow key={tech.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={tech.profile?.avatar_url || undefined} />
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{tech.profile?.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tech.specialties && tech.specialties.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tech.specialties.map((spec) => (
                              <Badge key={spec} variant="secondary">
                                {spec}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(tech.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tech.is_active ? 'default' : 'secondary'}>
                          {tech.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTechnician(tech.id)}
                            disabled={removeTechnician.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum técnico cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Adicione técnicos para gerenciar os tickets de suporte.
              </p>
              {isSuperAdmin && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Técnico
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
