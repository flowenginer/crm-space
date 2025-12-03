import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <SettingsIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Configurações em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Configure usuários, setores, permissões, integrações
                e todas as opções do sistema.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
