import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  Play, 
  FileText,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { useWhatsAppCalls } from '@/hooks/useWhatsAppCalls';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { WhatsAppCallLog, CallDirection, SentimentLabel } from '@/types/cloudapi';

export function CallHistory() {
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<CallDirection | 'all'>('all');
  const [sentimentFilter, setSentimentFilter] = useState<SentimentLabel | 'all'>('all');

  const { data: calls, isLoading } = useWhatsAppCalls({
    direction: directionFilter === 'all' ? undefined : directionFilter,
    sentimentLabel: sentimentFilter === 'all' ? undefined : sentimentFilter,
    limit: 100,
  });

  const filteredCalls = calls?.filter(call => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      call.contact?.full_name?.toLowerCase().includes(searchLower) ||
      call.contact?.phone?.includes(search) ||
      call.notes?.toLowerCase().includes(searchLower)
    );
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completada</Badge>;
      case 'accepted':
        return <Badge className="bg-green-500">Atendida</Badge>;
      case 'missed':
        return <Badge variant="destructive">Perdida</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitada</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'ringing':
        return <Badge variant="outline">Chamando</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Manual'}</Badge>;
    }
  };

  const getSentimentIcon = (label: SentimentLabel | null) => {
    switch (label) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'neutral':
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Histórico de Chamadas</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            
            <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as CallDirection | 'all')}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Direção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="inbound">Recebidas</SelectItem>
                <SelectItem value="outbound">Realizadas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sentimentFilter} onValueChange={(v) => setSentimentFilter(v as SentimentLabel | 'all')}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sentimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="positive">Positivo</SelectItem>
                <SelectItem value="neutral">Neutro</SelectItem>
                <SelectItem value="negative">Negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Direção</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Sentimento</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma chamada encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredCalls?.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {format(new Date(call.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {call.call_time}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{call.contact?.full_name || 'Desconhecido'}</span>
                      <span className="text-xs text-muted-foreground">{call.contact?.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="h-4 w-4 text-blue-500" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm">
                        {call.direction === 'inbound' ? 'Recebida' : 'Realizada'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(call.call_status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatDuration(call.duration_seconds)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(call.sentiment_label)}
                      {call.sentiment_score !== null && (
                        <span className="text-xs text-muted-foreground">
                          {(call.sentiment_score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {call.recording_url && (
                        <Button variant="ghost" size="icon" title="Ouvir gravação">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {call.transcription && (
                        <Button variant="ghost" size="icon" title="Ver transcrição">
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
