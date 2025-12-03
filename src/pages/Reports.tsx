import { BarChart3 } from 'lucide-react';

export default function Reports() {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Relatórios
        </h2>
        <div className="flex h-96 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl icon-gradient flex items-center justify-center mb-4 shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Relatórios em construção
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Dashboards detalhados, métricas de performance por vendedor,
              análise de canais e muito mais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
