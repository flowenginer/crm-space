import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SharedBoxManagement } from '@/components/settings/SharedBoxManagement';
import { EmailPermissionsSettings } from './EmailPermissionsSettings';

interface EmailSettingsProps {
  onBack: () => void;
}

export function EmailSettings({ onBack }: EmailSettingsProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Configurações do E-mail</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="shared-boxes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="shared-boxes">Caixas Compartilhadas</TabsTrigger>
            <TabsTrigger value="permissions">Autorizações</TabsTrigger>
            <TabsTrigger value="labels" disabled>Marcadores</TabsTrigger>
            <TabsTrigger value="rules" disabled>Regras Automáticas</TabsTrigger>
          </TabsList>

          <TabsContent value="shared-boxes" className="mt-6">
            <SharedBoxManagement />
          </TabsContent>

          <TabsContent value="permissions" className="mt-6">
            <EmailPermissionsSettings />
          </TabsContent>

          <TabsContent value="labels">
            {/* Futuro: Gerenciamento de marcadores */}
          </TabsContent>

          <TabsContent value="rules">
            {/* Futuro: Regras automáticas */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
