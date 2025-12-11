import { useState, useEffect } from 'react';
import { InternalChatSidebar } from '@/components/internal-chat/InternalChatSidebar';
import { InternalChatArea } from '@/components/internal-chat/InternalChatArea';
import { useInternalChatRealtime } from '@/hooks/useInternalChat';

export default function InternalChat() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Ativar realtime
  useInternalChatRealtime(selectedThreadId);

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-background">
      {/* Sidebar com lista de contatos/conversas */}
      <InternalChatSidebar
        selectedThreadId={selectedThreadId}
        onSelectThread={(threadId, userId) => {
          setSelectedThreadId(threadId);
          setSelectedUserId(userId);
        }}
      />

      {/* Área de chat */}
      <InternalChatArea
        threadId={selectedThreadId}
        otherUserId={selectedUserId}
        onThreadCreated={setSelectedThreadId}
      />
    </div>
  );
}
