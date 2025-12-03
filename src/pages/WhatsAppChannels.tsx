import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio } from 'lucide-react';

export default function WhatsAppChannels() {
  return (
    <div className="animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Canais WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <Radio className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Canais WhatsApp em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Configure múltiplos números de WhatsApp aqui.
                Conecte via API oficial da Meta ou WhatsApp Web.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
