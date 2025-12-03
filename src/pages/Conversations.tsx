import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function Conversations() {
  return (
    <div className="animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Conversas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Conversas em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                O módulo de conversas omnichannel será implementado em breve.
                Aqui você poderá gerenciar WhatsApp, Instagram, Facebook e outros canais.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
