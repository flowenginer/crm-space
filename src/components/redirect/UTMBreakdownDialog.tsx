import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart3, Users, UserCheck, TrendingUp, Download, AlertTriangle, Loader2 } from "lucide-react";
import { useUTMBreakdown } from "@/hooks/useUTMBreakdown";
import * as XLSX from "xlsx";

interface UTMBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | undefined;
  campaignName: string;
}

export function UTMBreakdownDialog({ open, onOpenChange, campaignId, campaignName }: UTMBreakdownDialogProps) {
  const { data, isLoading } = useUTMBreakdown(campaignId);

  const handleExportCSV = () => {
    if (!data?.breakdown) return;

    const exportData = data.breakdown.map((row) => ({
      "UTM Source": row.utm_source || "(direto)",
      "UTM Medium": row.utm_medium || "(none)",
      "UTM Campaign": row.utm_campaign || "(none)",
      Visitas: row.visits,
      Leads: row.leads,
      "Taxa Conv. (%)": row.visits > 0 ? ((row.leads / row.visits) * 100).toFixed(1) : "0.0",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UTM Breakdown");
    XLSX.writeFile(wb, `utm-breakdown-${campaignName.replace(/\s+/g, "-")}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Breakdown de UTMs - {campaignName}
          </DialogTitle>
          <DialogDescription>
            Análise detalhada de visitas, leads e conversões por origem de tráfego
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs font-medium">Visitas</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {data?.totals.total_visits || 0}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                    <UserCheck className="h-4 w-4" />
                    <span className="text-xs font-medium">Leads</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {data?.totals.total_leads || 0}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium">Conversão</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {data?.totals.overall_conversion_rate.toFixed(1) || 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-xs font-medium">Fontes</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {data?.breakdown.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Table Header with Export */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Detalhamento por UTM</h3>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data?.breakdown.length}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>

            {/* UTM Table */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UTM Source</TableHead>
                    <TableHead>UTM Medium</TableHead>
                    <TableHead>UTM Campaign</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Taxa Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.breakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum dado disponível
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.breakdown.map((row, index) => {
                      const conversionRate = row.visits > 0 ? (row.leads / row.visits) * 100 : 0;
                      const isUntracked = !row.utm_source;

                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={isUntracked ? "text-muted-foreground" : ""}>
                                {row.utm_source || "(direto)"}
                              </span>
                              {isUntracked && (
                                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                  Sem rastreamento
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={!row.utm_medium ? "text-muted-foreground" : ""}>
                            {row.utm_medium || "(none)"}
                          </TableCell>
                          <TableCell className={!row.utm_campaign ? "text-muted-foreground" : ""}>
                            {row.utm_campaign || "(none)"}
                          </TableCell>
                          <TableCell className="text-right font-medium">{row.visits}</TableCell>
                          <TableCell className="text-right font-medium">{row.leads}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="secondary"
                              className={
                                conversionRate >= 50
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : conversionRate >= 20
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                              }
                            >
                              {conversionRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Untracked Traffic Alert */}
            {data?.totals.has_untracked && (
              <Alert className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                  <strong>Tráfego sem rastreamento detectado:</strong> Algumas visitas não possuem parâmetros UTM.
                  Adicione UTMs aos seus links para melhor rastreamento de campanhas.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
