import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SwipeableView } from "@/components/mobile/SwipeableView";
import { MobileContactsList } from "@/components/mobile/MobileContactsList";
import { MobileChatArea } from "@/components/mobile/MobileChatArea";
import { MobileContactDetails } from "@/components/mobile/MobileContactDetails";
import { toast } from "sonner";

export default function MobileConversations() {
  const { tenantId, user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [currentPanel, setCurrentPanel] = useState(0);

  // Fetch conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ["mobile-conversations", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id,
          last_message_preview,
          last_message_at,
          unread_count,
          status,
          contact:contacts!inner(
            id,
            full_name,
            phone,
            avatar_url,
            email,
            city,
            state,
            lead_status,
            created_at,
            notes
          )
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "open")
        .order("last_message_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // Get selected conversation
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["mobile-messages", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];

      const { data, error } = await supabase
        .from("messages")
        .select("id, content, is_from_me, created_at, status, message_type")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedConversationId,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversationId || !selectedConversation) {
        throw new Error("No conversation selected");
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        contact_id: selectedConversation.contact.id,
        content,
        is_from_me: true,
        sender_id: userId,
        tenant_id: tenantId,
        message_type: "text",
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["mobile-messages", selectedConversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["mobile-conversations", tenantId],
      });
    },
    onError: () => {
      toast.error("Erro ao enviar mensagem");
    },
  });

  const handleSelectConversation = useCallback(
    (conv: typeof conversations[0]) => {
      setSelectedConversationId(conv.id);
      setCurrentPanel(1); // Go to chat
    },
    []
  );

  const handleBack = useCallback(() => {
    setCurrentPanel(0);
  }, []);

  const handlePanelChange = useCallback((index: number) => {
    setCurrentPanel(index);
  }, []);

  return (
    <div className="h-[100dvh] bg-background">
      <SwipeableView
        initialIndex={currentPanel}
        onIndexChange={handlePanelChange}
        labels={["Conversas", "Chat", "Cliente"]}
      >
        {/* Panel 0: Contacts List */}
        <MobileContactsList
          conversations={conversations.map((c) => ({
            id: c.id,
            contact: c.contact,
            last_message_preview: c.last_message_preview,
            last_message_at: c.last_message_at,
            unread_count: c.unread_count,
            status: c.status,
          }))}
          selectedId={selectedConversationId || undefined}
          onSelect={handleSelectConversation}
          isLoading={isLoadingConversations}
        />

        {/* Panel 1: Chat Area */}
        <MobileChatArea
          contact={selectedConversation?.contact}
          messages={messages}
          onSend={(content) => sendMessage.mutate(content)}
          onBack={handleBack}
          isLoading={isLoadingMessages}
        />

        {/* Panel 2: Contact Details */}
        <MobileContactDetails
          contact={selectedConversation?.contact}
          onEdit={() => {
            // TODO: Open edit modal
          }}
        />
      </SwipeableView>
    </div>
  );
}
