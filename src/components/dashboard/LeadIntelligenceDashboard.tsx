import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Layers, TrendingUp, DollarSign, Users, Shirt } from "lucide-react";
import { 
  useLeadIntelligenceByState, 
  useLeadIntelligenceBySegment, 
  useLeadIntelligence,
  STATE_NAMES 
} from "@/hooks/useLeadIntelligence";
import { useSegments } from "@/hooks/useSegments";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

interface LeadIntelligenceDashboardProps {
  dateFrom?: Date;
  dateTo?: Date;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export function LeadIntelligenceDashboard({ dateFrom, dateTo }: LeadIntelligenceDashboardProps) {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  
  const filters = useMemo(() => ({
    dateRange: { from: dateFrom, to: dateTo },
    state: selectedState,
    segmentId: selectedSegment,
  }), [dateFrom, dateTo, selectedState, selectedSegment]);
  
  const { data: stateData = [], isLoading: loadingStates } = useLeadIntelligenceByState(filters);
  const { data: segmentData = [], isLoading: loadingSegments } = useLeadIntelligenceBySegment(filters);
  const { data: crossData = [], isLoading: loadingCross } = useLeadIntelligence(filters);
  const { data: segments = [] } = useSegments();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Totais
  const totals = useMemo(() => {
    const total = stateData.reduce((acc, s) => ({
      leads: acc.leads + Number(s.total_leads),
      converted: acc.converted + Number(s.converted_leads),
      revenue: acc.revenue + Number(s.total_revenue),
    }), { leads: 0, converted: 0, revenue: 0 });
    
    return {
      ...total,
      conversionRate: total.leads > 0 ? (total.converted / total.leads * 100) : 0,
      avgTicket: total.converted > 0 ? total.revenue / total.converted : 0,
    };
  }, [stateData]);

  // Estados para o filtro
  const availableStates = useMemo(() => 
    stateData
      .filter(s => s.state !== 'Outro')
      .sort((a, b) => Number(b.total_leads) - Number(a.total_leads)),
    [stateData]
  );

  // Dados do gráfico por estado
  const stateChartData = useMemo(() => 
    stateData
      .filter(s => Number(s.total_leads) > 0)
      .slice(0, 10)
      .map(s => ({
        state: s.state,
        name: STATE_NAMES[s.state] || s.state,
        leads: Number(s.total_leads),
        converted: Number(s.converted_leads),
        revenue: Number(s.total_revenue),
        conversionRate: Number(s.conversion_rate),
      })),
    [stateData]
  );

  // Dados do gráfico por segmento
  const segmentChartData = useMemo(() => 
    segmentData
      .filter(s => Number(s.total_leads) > 0)
      .slice(0, 8)
      .map(s => ({
        name: s.segment_name,
        leads: Number(s.total_leads),
        converted: Number(s.converted_leads),
        conversionRate: Number(s.conversion_rate),
      })),
    [segmentData]
  );

  const isLoading = loadingStates || loadingSegments || loadingCross;

  return (
    <div className="space-y-6">
      {/* KPIs Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Total Leads</span>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totals.leads.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Conversões</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totals.converted.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Taxa Conversão</span>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : formatPercent(totals.conversionRate)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Receita Total</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : formatCurrency(totals.revenue)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Ticket Médio</span>
            </div>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : formatCurrency(totals.avgTicket)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros Interativos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Filtros de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
              <Select 
                value={selectedState || "all"} 
                onValueChange={(v) => setSelectedState(v === "all" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {availableStates.map((s) => (
                    <SelectItem key={s.state} value={s.state}>
                      {STATE_NAMES[s.state] || s.state} ({Number(s.total_leads)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Segmento</label>
              <Select 
                value={selectedSegment || "all"} 
                onValueChange={(v) => setSelectedSegment(v === "all" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os segmentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os segmentos</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedState || selectedSegment) && (
              <div className="flex items-end">
                <Badge variant="secondary" className="cursor-pointer" onClick={() => { setSelectedState(null); setSelectedSegment(null); }}>
                  Limpar filtros ✕
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico por Estado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Leads por Estado (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStates ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stateChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" />
                  <YAxis dataKey="state" type="category" width={40} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm text-muted-foreground">Leads: {data.leads}</p>
                          <p className="text-sm text-green-600">Conversões: {data.converted}</p>
                          <p className="text-sm text-amber-600">Taxa: {formatPercent(data.conversionRate)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="leads" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                    {stateChartData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gráfico por Segmento */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Leads por Segmento (Top 8)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSegments ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={segmentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="leads"
                    nameKey="name"
                    label={({ name, percent }) => `${name.slice(0, 10)}${name.length > 10 ? '...' : ''} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {segmentChartData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm text-muted-foreground">Leads: {data.leads}</p>
                          <p className="text-sm text-green-600">Conversões: {data.converted}</p>
                          <p className="text-sm text-amber-600">Taxa: {formatPercent(data.conversionRate)}</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada por Estado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Análise por Estado
            {selectedState && (
              <Badge variant="outline" className="ml-2">
                Filtrado: {STATE_NAMES[selectedState] || selectedState}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Conversões</TableHead>
                  <TableHead className="text-center">Taxa Conv.</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStates ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : stateData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  stateData.map((row) => (
                    <TableRow 
                      key={row.state} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedState(selectedState === row.state ? null : row.state)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{row.state === 'Outro' ? '🌐' : '📍'}</span>
                          {STATE_NAMES[row.state] || row.state}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{Number(row.total_leads).toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-semibold">{Number(row.converted_leads)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={Number(row.conversion_rate) >= 5 ? "default" : Number(row.conversion_rate) >= 2 ? "secondary" : "outline"}>
                          {formatPercent(Number(row.conversion_rate))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatCurrency(Number(row.total_revenue))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(row.avg_ticket))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Tabela Detalhada por Segmento */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Análise por Segmento
            {selectedSegment && (
              <Badge variant="outline" className="ml-2">
                Filtrado
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Segmento</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Conversões</TableHead>
                  <TableHead className="text-center">Taxa Conv.</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSegments ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : segmentData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  segmentData.map((row) => (
                    <TableRow 
                      key={row.segment_id || 'sem_segmento'}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedSegment(selectedSegment === row.segment_id ? null : row.segment_id)}
                    >
                      <TableCell className="font-medium">{row.segment_name}</TableCell>
                      <TableCell className="text-center font-semibold">{Number(row.total_leads).toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-semibold">{Number(row.converted_leads)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={Number(row.conversion_rate) >= 5 ? "default" : Number(row.conversion_rate) >= 2 ? "secondary" : "outline"}>
                          {formatPercent(Number(row.conversion_rate))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatCurrency(Number(row.total_revenue))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(row.avg_ticket))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Cruzamento Estado x Segmento */}
      {(selectedState || selectedSegment) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Cruzamento Detalhado
              {selectedState && <Badge variant="outline">{STATE_NAMES[selectedState] || selectedState}</Badge>}
              {selectedSegment && <Badge variant="outline">Segmento Selecionado</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Conv.</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCross ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : crossData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum dado para o filtro selecionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    crossData.slice(0, 50).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{STATE_NAMES[row.state] || row.state}</TableCell>
                        <TableCell>{row.segment_name}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{row.campaign}</TableCell>
                        <TableCell className="text-center font-semibold">{Number(row.total_leads)}</TableCell>
                        <TableCell className="text-center text-green-600">{Number(row.converted_leads)}</TableCell>
                        <TableCell className="text-center">{formatPercent(Number(row.conversion_rate))}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium">
                          {formatCurrency(Number(row.total_revenue))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
