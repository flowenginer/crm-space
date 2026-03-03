import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, TrendingUp } from "lucide-react";

interface SalesReportProps {
  data: {
    totalOrders: number;
    matchedOrders: number;
    unmatchedOrders: number;
    totalRevenue: number;
    summary: Record<string, { count: number; total: number }>;
    creativeSummary: Record<string, { count: number; total: number; origem: string }>;
    orders: Array<{
      pedido: string;
      nomeComprador: string;
      telefone: string;
      totalPedido: number;
      matchCRM: boolean;
      nomeCRM: string | null;
      origem: string;
      criativo: string | null;
    }>;
  };
}

const originColors: Record<string, string> = {
  "Linktree": "bg-green-500/10 text-green-700 border-green-500/20",
  "CTWA Ads": "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Meta Ads Direto (API)": "bg-purple-500/10 text-purple-700 border-purple-500/20",
  "Redirect (Meta UTM)": "bg-orange-500/10 text-orange-700 border-orange-500/20",
  "WhatsApp Orgânico": "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "Manual": "bg-gray-500/10 text-gray-700 border-gray-500/20",
  "Sem origem definida": "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  "Não encontrado no CRM": "bg-red-500/10 text-red-700 border-red-500/20",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function SalesReport({ data }: SalesReportProps) {
  const sortedSummary = Object.entries(data.summary).sort((a, b) => b[1].total - a[1].total);
  const sortedCreatives = Object.entries(data.creativeSummary).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Total de Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{data.matchedOrders}</div>
            <p className="text-xs text-muted-foreground">Encontrados no CRM</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{data.unmatchedOrders}</div>
            <p className="text-xs text-muted-foreground">Não encontrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Faturamento Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Origin Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resumo por Origem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">% Pedidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSummary.map(([origem, stats]) => (
                <TableRow key={origem}>
                  <TableCell>
                    <Badge variant="outline" className={originColors[origem] || ""}>
                      {origem}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{stats.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(stats.total)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(stats.count > 0 ? stats.total / stats.count : 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {((stats.count / data.totalOrders) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Creative Summary */}
      {sortedCreatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Criativos Identificados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criativo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCreatives.map(([criativo, stats]) => (
                  <TableRow key={criativo}>
                    <TableCell className="font-medium max-w-[300px] truncate">{criativo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={originColors[stats.origem] || ""}>
                        {stats.origem}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{stats.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stats.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Pedido ({data.orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>Nome CRM</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Criativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((order) => (
                  <TableRow key={order.pedido}>
                    <TableCell className="font-mono text-xs">{order.pedido}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm">{order.nomeComprador}</TableCell>
                    <TableCell className="text-xs">{order.telefone}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(order.totalPedido)}</TableCell>
                    <TableCell>
                      {order.matchCRM ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{order.nomeCRM || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${originColors[order.origem] || ""}`}>
                        {order.origem}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs">{order.criativo || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
