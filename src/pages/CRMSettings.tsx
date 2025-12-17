import { useSearchParams } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequiredFieldsSettings } from '@/components/settings/RequiredFieldsSettings';

export default function CRMSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'required-fields';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          Configurações CRM
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure regras e comportamentos do CRM
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="required-fields">Campos Obrigatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="required-fields">
          <RequiredFieldsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}