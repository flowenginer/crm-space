import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function Reports() {
  return (
    <div className="animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Relatórios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Relatórios em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Dashboards detalhados, métricas de performance por vendedor,
                análise de canais e muito mais.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
