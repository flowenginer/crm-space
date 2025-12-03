import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function Contacts() {
  return (
    <div className="animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Contatos em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Gerencie todos os seus contatos em um só lugar.
                Importação, exportação, tags e segmentação avançada.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
