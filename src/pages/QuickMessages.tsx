import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';

export default function QuickMessages() {
  return (
    <div className="animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Mensagens Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <Zap className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Mensagens Rápidas em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Templates e atalhos de mensagens serão configurados aqui.
                Crie respostas rápidas para agilizar o atendimento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
