import { useUsersWithTenantIssues, useUserDiagnostics } from '@/hooks/useTenantDiagnostics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Users, ShieldAlert, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function TenantDiagnosticsPanel() {
  const { data: usersWithIssues = [], isLoading: isLoadingIssues } = useUsersWithTenantIssues();
  const { data: allUsers = [], isLoading: isLoadingUsers } = useUserDiagnostics();

  const isLoading = isLoadingIssues || isLoadingUsers;

  const issueCount = usersWithIssues.length;
  const totalUsers = allUsers.length;
  const healthyUsers = totalUsers - issueCount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Saudáveis</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{healthyUsers}</div>
          </CardContent>
        </Card>

        <Card className={issueCount > 0 ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários com Problemas</CardTitle>
            <ShieldAlert className={`h-4 w-4 ${issueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${issueCount > 0 ? 'text-destructive' : ''}`}>
              {issueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Alert */}
      {issueCount > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Problemas Detectados</CardTitle>
            </div>
            <CardDescription>
              Os seguintes usuários têm problemas de configuração de tenant que precisam ser corrigidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Problema</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithIssues.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        {user.tenant_name || (
                          <span className="text-destructive">Não encontrado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="whitespace-nowrap">
                          {user.issue_type === 'default_tenant' && 'Tenant Default'}
                          {user.issue_type === 'inactive_tenant' && 'Tenant Inativo'}
                          {user.issue_type === 'missing_tenant' && 'Tenant Inexistente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* All Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnóstico Completo de Usuários</CardTitle>
          <CardDescription>
            Visão geral de todos os usuários e seus tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Conversas</TableHead>
                  <TableHead className="text-right">Contatos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((user) => (
                  <TableRow key={user.user_id} className={user.has_issues ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      {user.has_issues ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.full_name}
                      {user.is_super_admin && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Super Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{user.tenant_name || 'N/A'}</span>
                        {user.is_default_tenant && (
                          <Badge variant="outline" className="text-xs w-fit">
                            Default
                          </Badge>
                        )}
                        {user.tenant_is_active === false && (
                          <Badge variant="destructive" className="text-xs w-fit">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.user_role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{user.conversation_count}</TableCell>
                    <TableCell className="text-right">{user.contact_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
