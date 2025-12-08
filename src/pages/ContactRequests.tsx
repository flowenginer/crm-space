import { ContactRequestsPanel } from '@/components/settings/ContactRequestsPanel';

export default function ContactRequests() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Requisições de Contato</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações de acesso a contatos de outros departamentos
          </p>
        </div>
      </div>

      {/* Panel */}
      <ContactRequestsPanel />
    </div>
  );
}
