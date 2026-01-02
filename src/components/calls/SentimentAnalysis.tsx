import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, User, Clock } from 'lucide-react';
import { useCallStatistics, useNegativeSentimentCalls } from '@/hooks/useWhatsAppCalls';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SentimentAnalysis() {
  const { data: stats, isLoading: statsLoading } = useCallStatistics();
  const { data: negativeCalls, isLoading: negativeLoading } = useNegativeSentimentCalls(10);

  const isLoading = statsLoading || negativeLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const total = (stats?.positive_calls || 0) + (stats?.neutral_calls || 0) + (stats?.negative_calls || 0);
  const positivePercent = total > 0 ? ((stats?.positive_calls || 0) / total) * 100 : 0;
  const neutralPercent = total > 0 ? ((stats?.neutral_calls || 0) / total) * 100 : 0;
  const negativePercent = total > 0 ? ((stats?.negative_calls || 0) / total) * 100 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Distribuição de Sentimento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Distribuição de Sentimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Barra de progresso visual */}
          <div className="h-4 rounded-full overflow-hidden flex">
            <div 
              className="bg-green-500 transition-all" 
              style={{ width: `${positivePercent}%` }}
            />
            <div 
              className="bg-gray-400 transition-all" 
              style={{ width: `${neutralPercent}%` }}
            />
            <div 
              className="bg-red-500 transition-all" 
              style={{ width: `${negativePercent}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{stats?.positive_calls || 0}</p>
              <p className="text-xs text-muted-foreground">{positivePercent.toFixed(1)}% Positivo</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <Minus className="h-4 w-4 text-gray-500" />
              </div>
              <p className="text-2xl font-bold text-gray-600">{stats?.neutral_calls || 0}</p>
              <p className="text-xs text-muted-foreground">{neutralPercent.toFixed(1)}% Neutro</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600">{stats?.negative_calls || 0}</p>
              <p className="text-xs text-muted-foreground">{negativePercent.toFixed(1)}% Negativo</p>
            </div>
          </div>

          {total === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">
              Nenhuma chamada com análise de sentimento ainda.
              <br />
              Habilite a transcrição e análise nas configurações da Cloud API.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Chamadas com Sentimento Negativo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Chamadas que Requerem Atenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          {negativeCalls?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mb-2 text-green-500" />
              <p className="text-center">
                Nenhuma chamada com sentimento negativo!
                <br />
                <span className="text-sm">Ótimo trabalho da equipe.</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {negativeCalls?.map((call) => (
                <div 
                  key={call.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                >
                  <div className="p-1.5 rounded-full bg-red-100">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {call.contact?.full_name || 'Desconhecido'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(call.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      {call.user && (
                        <>
                          <span>•</span>
                          <span>Atendente: {call.user.full_name}</span>
                        </>
                      )}
                    </div>
                    {call.transcription && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        "{call.transcription.substring(0, 100)}..."
                      </p>
                    )}
                  </div>
                  {call.sentiment_score !== null && (
                    <Badge variant="destructive" className="shrink-0">
                      {(call.sentiment_score * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
