import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserTemplateStat } from '@/hooks/useTemplateStats';

interface TemplatesCostTableProps {
  data: UserTemplateStat[];
  isLoading?: boolean;
}

export function TemplatesCostTable({ data, isLoading }: TemplatesCostTableProps) {
  const handleExport = () => {
    if (data.length === 0) return;

    const headers = ['Usuário', 'Departamento', 'Role', 'Marketing', 'Utility', 'Auth', 'Total', 'Custo Est. (R$)'];
    const rows = data.map(stat => [
      stat.userName,
      stat.departmentName || '-',
      stat.role || '-',
      stat.marketingCount,
      stat.utilityCount,
      stat.authenticationCount,
      stat.totalCount,
      stat.estimatedCost.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template-costs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalCost = data.reduce((sum, stat) => sum + stat.estimatedCost, 0);
  const totalTemplates = data.reduce((sum, stat) => sum + stat.totalCount, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            Detalhamento de Custos
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TableIcon className="h-4 w-4" />
          Detalhamento de Custos
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={data.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-center">
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-500 border-purple-500/30">
                      MKTG
                    </Badge>
                  </TableHead>
                  <TableHead className="text-center">
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                      UTIL
                    </Badge>
                  </TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-right">Custo Est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((stat, index) => (
                  <TableRow key={stat.userId || index}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{stat.userName}</span>
                        {stat.role && (
                          <span className="text-xs text-muted-foreground">{stat.role}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {stat.departmentName || '-'}
                    </TableCell>
                    <TableCell className="text-center">{stat.marketingCount}</TableCell>
                    <TableCell className="text-center">{stat.utilityCount}</TableCell>
                    <TableCell className="text-center font-medium">{stat.totalCount}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      R$ {stat.estimatedCost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Footer row with totals */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={4} className="text-right">
                    Total:
                  </TableCell>
                  <TableCell className="text-center">{totalTemplates}</TableCell>
                  <TableCell className="text-right text-green-600">
                    R$ {totalCost.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
