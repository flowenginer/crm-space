import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TenantWithStats } from '@/hooks/useSuperAdminTenants';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, MoreHorizontal, Edit, Power, AlertTriangle, Trash2 } from 'lucide-react';

interface TenantsTableProps {
  tenants: TenantWithStats[];
  onEdit: (tenant: TenantWithStats) => void;
  onToggleStatus: (tenant: TenantWithStats) => void;
  onDelete: (tenant: TenantWithStats) => void;
}

const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const planColors: Record<string, string> = {
  free: 'bg-gray-500/10 text-gray-500',
  pro: 'bg-blue-500/10 text-blue-500',
  enterprise: 'bg-purple-500/10 text-purple-500',
};

export function TenantsTable({ tenants, onEdit, onToggleStatus, onDelete }: TenantsTableProps) {
  const [search, setSearch] = useState('');

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Contatos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum tenant encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map((tenant) => {
                const usersExceeded = tenant.user_count > tenant.max_users;
                const contactsExceeded = tenant.contact_count > tenant.max_contacts;

                return (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-sm text-muted-foreground">{tenant.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={planColors[tenant.plan_type] || planColors.free}>
                        {tenant.plan_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className={usersExceeded ? 'text-destructive font-medium' : ''}>
                          {tenant.user_count}/{tenant.max_users}
                        </span>
                        {usersExceeded && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className={contactsExceeded ? 'text-destructive font-medium' : ''}>
                          {tenant.contact_count.toLocaleString('pt-BR')}/
                          {tenant.max_contacts.toLocaleString('pt-BR')}
                        </span>
                        {contactsExceeded && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                        {tenant.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(tenant)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggleStatus(tenant)}>
                            <Power className="h-4 w-4 mr-2" />
                            {tenant.is_active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          {tenant.id !== MASTER_TENANT_ID && (
                            <DropdownMenuItem 
                              onClick={() => onDelete(tenant)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
