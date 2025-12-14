import { useState } from 'react';
import { EmailSidebar, ExtendedEmailFolder } from '@/components/internal-email/EmailSidebar';
import { EmailList } from '@/components/internal-email/EmailList';
import { SharedBoxEmailList } from '@/components/internal-email/SharedBoxEmailList';
import { EmailViewer } from '@/components/internal-email/EmailViewer';
import { EmailComposerModal } from '@/components/internal-email/EmailComposerModal';
import { DesignerMetrics } from '@/components/internal-email/DesignerMetrics';
import { useInternalEmailRealtime, type EmailFolder } from '@/hooks/useInternalEmail';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function InternalEmail() {
  const [currentFolder, setCurrentFolder] = useState<ExtendedEmailFolder>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ emailId: string; type: 'reply' | 'replyAll' | 'forward' } | null>(null);
  const { isAdmin, isSupervisor } = usePermissions();

  // Ativar realtime
  useInternalEmailRealtime();

  const handleReply = (emailId: string, type: 'reply' | 'replyAll' | 'forward') => {
    setReplyTo({ emailId, type });
    setIsComposerOpen(true);
  };

  const handleCloseComposer = () => {
    setIsComposerOpen(false);
    setReplyTo(null);
  };

  // Verificar se é uma pasta compartilhada
  const isSharedFolder = currentFolder.startsWith('shared_');
  const sharedBoxId = isSharedFolder ? currentFolder.replace(/^shared_/, '').replace(/_(pending|progress|completed)$/, '') : null;
  const sharedStatusFilter = isSharedFolder 
    ? currentFolder.endsWith('_pending') ? 'pending' 
    : currentFolder.endsWith('_progress') ? 'in_progress'
    : currentFolder.endsWith('_completed') ? 'completed'
    : 'all'
    : undefined;

  // Verificar se é a pasta "Todos" (super admin)
  const isAllFolder = currentFolder === 'all';
  const showFilters = isAllFolder || isAdmin || isSupervisor;
  const showDesignerMetrics = (isAdmin || isSupervisor) && !selectedEmailId;

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Sidebar */}
      <EmailSidebar
        currentFolder={currentFolder}
        onFolderChange={(folder) => {
          setCurrentFolder(folder);
          setSelectedEmailId(null);
        }}
        onCompose={() => setIsComposerOpen(true)}
      />

      {/* Lista de e-mails ou visualizador */}
      <div className="flex-1 flex overflow-hidden">
        {selectedEmailId ? (
          <EmailViewer
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onReply={handleReply}
          />
        ) : isSharedFolder && sharedBoxId ? (
          <SharedBoxEmailList
            sharedBoxId={sharedBoxId}
            statusFilter={sharedStatusFilter as 'pending' | 'in_progress' | 'completed' | 'all'}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectEmail={setSelectedEmailId}
          />
        ) : (
          <EmailList
            folder={(isAllFolder ? 'inbox' : currentFolder) as EmailFolder}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectEmail={setSelectedEmailId}
            showFilters={showFilters}
          />
        )}

        {/* Painel de métricas para admin/supervisor */}
        {showDesignerMetrics && (
          <div className="w-64 border-l p-4 hidden lg:block">
            <DesignerMetrics />
          </div>
        )}
      </div>

      {/* Botão flutuante para nova mensagem (mobile) */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden"
        onClick={() => setIsComposerOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Modal de composição */}
      <EmailComposerModal
        open={isComposerOpen}
        onOpenChange={handleCloseComposer}
        replyTo={replyTo}
      />
    </div>
  );
}