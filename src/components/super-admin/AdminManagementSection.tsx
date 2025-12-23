import { useState } from 'react';
import { 
  useAllSuperAdmins, 
  useAllUsersForMaster, 
  usePromoteToSuperAdmin, 
  useRemoveSuperAdmin,
  useIsMaster 
} from '@/hooks/useSuperAdminManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Crown, Shield, ShieldOff, Search, UserPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminManagementSection() {
  const { data: superAdmins = [], isLoading: loadingAdmins } = useAllSuperAdmins();
  const { data: allUsers = [], isLoading: loadingUsers } = useAllUsersForMaster();
  const { data: isMaster } = useIsMaster();
  const promoteToSuperAdmin = usePromoteToSuperAdmin();
  const removeSuperAdmin = useRemoveSuperAdmin();
  
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = allUsers.filter(user => 
    !user.is_super_admin && 
    (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePromote = (userId: string) => {
    promoteToSuperAdmin.mutate(userId);
  };

  const handleRemove = (userId: string) => {
    removeSuperAdmin.mutate(userId);
  };

  if (loadingAdmins || loadingUsers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Super Admins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Super Admins Ativos
          </CardTitle>
          <CardDescription>
            Usuários com acesso ao painel de administração global
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {superAdmins.map((admin) => (
                <TableRow key={admin.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{admin.full_name}</span>
                      {admin.is_master && (
                        <Badge variant="default" className="bg-yellow-500 text-black">
                          <Crown className="h-3 w-3 mr-1" />
                          MASTER
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{admin.tenant_name || 'Sem tenant'}</TableCell>
                  <TableCell>
                    {format(new Date(admin.profile_created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {admin.is_master ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Protegido
                      </Badge>
                    ) : isMaster ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover Super Admin</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover <strong>{admin.full_name}</strong> como Super Admin?
                              Este usuário perderá acesso ao painel de administração global.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleRemove(admin.user_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Sem permissão
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {superAdmins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum Super Admin encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add New Super Admin (Only MASTER can see this) */}
      {isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Adicionar Super Admin
            </CardTitle>
            <CardDescription>
              Promova um usuário existente a Super Admin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>{user.tenant_name || 'Sem tenant'}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-primary">
                              <Shield className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Promover a Super Admin</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja promover <strong>{user.full_name}</strong> a Super Admin?
                                Este usuário terá acesso ao painel de administração global.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePromote(user.user_id)}>
                                Promover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {searchTerm ? 'Nenhum usuário encontrado' : 'Todos os usuários já são Super Admins'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
