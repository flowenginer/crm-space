import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Loader2, TrendingUp, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadOriginData, ORIGIN_CONFIG } from '@/hooks/useLeadJourneyDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OriginBreakdownChartProps {
  data: LeadOriginData[];
  isLoading?: boolean;
  selectedOrigin?: string | null;
  onOriginClick?: (origin: string | null) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground">{data.label}</p>
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{data.total}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Conversões: <span className="font-semibold text-primary">{data.converted}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Taxa: <span className="font-semibold text-accent">{data.conversionRate.toFixed(1)}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export function OriginBreakdownChart({ data, isLoading, selectedOrigin, onOriginClick }: OriginBreakdownChartProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Leads por Origem
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Leads por Origem
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.total, 0);
  const selectedData = selectedOrigin ? data.find(d => d.origin === selectedOrigin) : null;

  const handlePieClick = (entry: LeadOriginData) => {
    if (onOriginClick) {
      // Toggle: if already selected, deselect
      if (selectedOrigin === entry.origin) {
        onOriginClick(null);
      } else {
        onOriginClick(entry.origin);
      }
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Leads por Origem
          </span>
          <span className="text-2xl font-bold text-foreground">{total}</span>
        </CardTitle>
        
        {/* Selected Origin Badge */}
        {selectedOrigin && selectedData && (
          <div className="flex items-center gap-2 mt-2">
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1.5"
              style={{ backgroundColor: `${selectedData.color}20`, borderColor: selectedData.color }}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedData.color }}
              />
              <span>Filtro: {selectedData.label}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onOriginClick?.(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={120}
              paddingAngle={3}
              dataKey="total"
              nameKey="label"
              onClick={(_, index) => handlePieClick(data[index])}
              style={{ cursor: 'pointer' }}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  opacity={selectedOrigin && selectedOrigin !== entry.origin ? 0.3 : 1}
                  className="transition-opacity duration-200"
                  stroke={selectedOrigin === entry.origin ? entry.color : 'transparent'}
                  strokeWidth={selectedOrigin === entry.origin ? 3 : 0}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Origin Cards - Clickable */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.map((origin) => (
            <button
              key={origin.origin}
              onClick={() => handlePieClick(origin)}
              className={cn(
                "flex flex-col p-2.5 rounded-lg border transition-all duration-200 text-left",
                selectedOrigin === origin.origin
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border bg-muted/50 hover:bg-muted hover:border-muted-foreground/30",
                selectedOrigin && selectedOrigin !== origin.origin && "opacity-50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: origin.color }}
                  />
                  <span className="text-xs font-medium text-muted-foreground">{origin.label}</span>
                </div>
                <span className="text-sm font-bold">{origin.total}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">Conversão</span>
                <span className="text-xs font-semibold text-primary">{origin.conversionRate.toFixed(1)}%</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Origin Details */}
        {selectedData && (
          <div className="mt-4 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedData.color }}
              />
              <span className="font-medium">{selectedData.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{selectedData.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{selectedData.converted}</p>
                <p className="text-[10px] text-muted-foreground">Convertidos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-accent">{selectedData.conversionRate.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">Taxa</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
