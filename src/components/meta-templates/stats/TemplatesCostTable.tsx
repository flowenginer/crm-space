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
import { TableIcon, Download, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserTemplateStat } from '@/hooks/useTemplateStats';

interface TemplatesCostTableProps {
  data: UserTemplateStat[];
  isLoading?: boolean;
}

export function TemplatesCostTable({ data, isLoading }: TemplatesCostTableProps) {
  const handleExport = () => {
    if (data.length === 0) return;

    const headers = ['Usuário', 'Departamento', 'Role', 'Total', 'Fora Janela', 'Dentro Janela', 'Marketing', 'Utility', 'Auth', 'Custo Real (R$)'];
    const rows = data.map(stat => [
      stat.userName,
      stat.departmentName || '-',
      stat.role || '-',
      stat.totalCount,
      stat.outsideWindowCount,
      stat.insideWindowCount,
      stat.marketingCount,
      stat.utilityCount,
      stat.authenticationCount,
      stat.chargedCost.toFixed(2),
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

  const totalChargedCost = data.reduce((sum, stat) => sum + stat.chargedCost, 0);
  const totalTemplates = data.reduce((sum, stat) => sum + stat.totalCount, 0);
  const totalOutsideWindow = data.reduce((sum, stat) => sum + stat.outsideWindowCount, 0);
  const totalInsideWindow = data.reduce((sum, stat) => sum + stat.insideWindowCount, 0);

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
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-xs">Cobrados</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs">Grátis</span>
                    </div>
                  </TableHead>
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
                  <TableHead className="text-right">Custo Real</TableHead>
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
                    <TableCell className="text-center font-medium">{stat.totalCount}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-orange-600 font-medium">{stat.outsideWindowCount}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-emerald-600">{stat.insideWindowCount}</span>
                    </TableCell>
                    <TableCell className="text-center">{stat.marketingCount}</TableCell>
                    <TableCell className="text-center">{stat.utilityCount}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      R$ {stat.chargedCost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Footer row with totals */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={2} className="text-right">
                    Total:
                  </TableCell>
                  <TableCell className="text-center">{totalTemplates}</TableCell>
                  <TableCell className="text-center text-orange-600">{totalOutsideWindow}</TableCell>
                  <TableCell className="text-center text-emerald-600">{totalInsideWindow}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="text-right text-green-600">
                    R$ {totalChargedCost.toFixed(2)}
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
