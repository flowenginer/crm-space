import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function CRM() {
  return (
    <div className="animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>CRM - Gestão de Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">CRM em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Pipeline de vendas, kanban de leads e funil de conversão serão implementados aqui.
                Gerencie todo o ciclo de vida dos seus clientes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
