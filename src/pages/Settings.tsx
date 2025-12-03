import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Configurações
        </h2>
        <div className="flex h-96 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl icon-gradient flex items-center justify-center mb-4 shadow-lg">
              <SettingsIcon className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Configurações em construção
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Configure usuários, setores, permissões, integrações
              e todas as opções do sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
