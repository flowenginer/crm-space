import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Search, Clock, CheckCircle, User, Phone, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserTemplateContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  startDate: Date;
  endDate: Date;
}

interface TemplateContact {
  id: string;
  contactName: string;
  contactPhone: string;
  templateContent: string;
  sentAt: Date;
  isOutsideWindow: boolean;
  category: string;
}

export function UserTemplateContactsModal({
  open,
  onOpenChange,
  userId,
  userName,
  startDate,
  endDate,
}: UserTemplateContactsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Query to fetch contacts that received templates from this user (AFTER assignment)
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['user-template-contacts', userId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<TemplateContact[]> => {
      // First get all template messages from conversations assigned to this user
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          conversation_id,
          conversation:conversations!inner(
            id,
            assigned_to,
            contact:contacts(id, full_name, phone)
          )
        `)
        .eq('message_type', 'template')
        .eq('conversations.assigned_to', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching template contacts:', error);
        return [];
      }

      if (!messages || messages.length === 0) return [];

      // Get conversation IDs to fetch assignment history
      const conversationIds = [...new Set(messages.map(m => m.conversation_id).filter(Boolean))];
      
      // Fetch assignment history for these conversations
      const { data: assignmentHistory } = await supabase
        .from('lead_assignment_history')
        .select('conversation_id, assigned_to, assigned_at')
        .in('conversation_id', conversationIds)
        .eq('assigned_to', userId)
        .order('assigned_at', { ascending: true });

      // Create map: conversation_id -> first assignment date to this user
      const assignmentMap = new Map<string, Date>();
      assignmentHistory?.forEach(h => {
        if (!assignmentMap.has(h.conversation_id)) {
          assignmentMap.set(h.conversation_id, new Date(h.assigned_at));
        }
      });

      // Get client messages for window calculation
      const { data: clientMessages } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', conversationIds)
        .eq('is_from_me', false)
        .order('created_at', { ascending: false });

      // Map: conversation_id -> array of client message dates
      const clientMsgMap = new Map<string, Date[]>();
      clientMessages?.forEach(msg => {
        if (!clientMsgMap.has(msg.conversation_id)) {
          clientMsgMap.set(msg.conversation_id, []);
        }
        clientMsgMap.get(msg.conversation_id)!.push(new Date(msg.created_at));
      });

      // Find last client message before a given time
      const findLastClientMsgBefore = (conversationId: string, beforeTime: Date): Date | null => {
        const msgs = clientMsgMap.get(conversationId) || [];
        for (const msgDate of msgs) {
          if (msgDate < beforeTime) return msgDate;
        }
        return null;
      };

      // Filter and build result - only templates sent AFTER user was assigned
      const result: TemplateContact[] = [];
      
      for (const msg of messages) {
        const conversation = msg.conversation as any;
        const contact = conversation?.contact;
        
        if (!contact) continue;

        const templateSentAt = new Date(msg.created_at);
        const assignedAt = assignmentMap.get(msg.conversation_id);

        // ✅ CRITICAL: Only include if template was sent AFTER the user was assigned
        if (!assignedAt || templateSentAt < assignedAt) {
          continue; // Skip templates sent before assignment (by IA/system)
        }

        // Calculate if outside 24h window
        const lastClientMsg = findLastClientMsgBefore(msg.conversation_id, templateSentAt);
        let isOutsideWindow = true;
        if (lastClientMsg) {
          const hoursDiff = (templateSentAt.getTime() - lastClientMsg.getTime()) / (1000 * 60 * 60);
          isOutsideWindow = hoursDiff > 24;
        }

        result.push({
          id: msg.id,
          contactName: contact.full_name || 'Desconhecido',
          contactPhone: contact.phone || '',
          templateContent: msg.content || '',
          sentAt: templateSentAt,
          isOutsideWindow,
          category: 'utility',
        });
      }

      return result;
    },
    enabled: open && !!userId,
    staleTime: 30000,
  });

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.contactName.toLowerCase().includes(query) ||
      c.contactPhone.includes(query)
    );
  }, [contacts, searchQuery]);

  // Export to CSV
  const handleExport = () => {
    if (filteredContacts.length === 0) return;

    const headers = ['Contato', 'Telefone', 'Data/Hora', 'Status Janela', 'Categoria', 'Template'];
    const rows = filteredContacts.map(c => [
      c.contactName,
      c.contactPhone,
      format(c.sentAt, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      c.isOutsideWindow ? 'Fora (Cobrado)' : 'Dentro (Grátis)',
      c.category,
      `"${c.templateContent.replace(/"/g, '""').substring(0, 100)}..."`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `templates-${userName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const outsideCount = filteredContacts.filter(c => c.isOutsideWindow).length;
  const insideCount = filteredContacts.filter(c => !c.isOutsideWindow).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Templates enviados por {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats summary */}
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {filteredContacts.length} templates
            </Badge>
            <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300 bg-orange-50">
              <Clock className="h-3.5 w-3.5" />
              {outsideCount} cobrados
            </Badge>
            <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300 bg-emerald-50">
              <CheckCircle className="h-3.5 w-3.5" />
              {insideCount} grátis
            </Badge>
          </div>

          {/* Search and export */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredContacts.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>

          {/* Table */}
          <ScrollArea className="h-[400px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando contatos...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p>Nenhum template encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Template</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.contactName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="text-xs">{contact.contactPhone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(contact.sentAt, 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        {contact.isOutsideWindow ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Cobrado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Grátis
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.templateContent.substring(0, 50)}...
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}