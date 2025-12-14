import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DesignerMetric {
  id: string;
  full_name: string;
  avatar_url: string | null;
  in_progress: number;
  completed: number;
  total: number;
}

function useDesignerMetrics() {
  return useQuery({
    queryKey: ['designer-email-metrics'],
    queryFn: async () => {
      // Busca todas as caixas compartilhadas de design
      const { data: sharedBoxes } = await supabase
        .from('email_shared_boxes')
        .select('id')
        .eq('is_active', true);

      if (!sharedBoxes?.length) return [];

      const boxIds = sharedBoxes.map(b => b.id);

      // Busca métricas agregadas por designer
      const { data: emails } = await supabase
        .from('internal_emails')
        .select(`
          claimed_by,
          workflow_status,
          claimed_by_user:profiles!internal_emails_claimed_by_fkey(id, full_name, avatar_url)
        `)
        .in('shared_box_id', boxIds)
        .eq('status', 'sent')
        .not('claimed_by', 'is', null);

      if (!emails?.length) return [];

      // Agrupa por designer
      const metricsMap = new Map<string, DesignerMetric>();

      emails.forEach(email => {
        if (!email.claimed_by || !email.claimed_by_user) return;
        
        const user = email.claimed_by_user as { id: string; full_name: string; avatar_url: string | null };
        const existing = metricsMap.get(email.claimed_by) || {
          id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          in_progress: 0,
          completed: 0,
          total: 0
        };

        existing.total++;
        if (email.workflow_status === 'in_progress') existing.in_progress++;
        if (email.workflow_status === 'completed') existing.completed++;

        metricsMap.set(email.claimed_by, existing);
      });

      return Array.from(metricsMap.values()).sort((a, b) => b.total - a.total);
    },
    refetchInterval: 30000
  });
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export function DesignerMetrics() {
  const { data: metrics, isLoading } = useDesignerMetrics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Métricas dos Designers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!metrics?.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Métricas dos Designers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum e-mail processado ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxTotal = Math.max(...metrics.map(m => m.total));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Métricas dos Designers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((designer, index) => {
          const progressPercent = maxTotal > 0 ? (designer.total / maxTotal) * 100 : 0;
          
          return (
            <div key={designer.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={designer.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(designer.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {index === 0 && (
                    <span className="absolute -top-1 -right-1 text-xs">🏆</span>
                  )}
                </div>
                <span className="text-xs font-medium truncate flex-1">
                  {designer.full_name}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="h-5 text-[10px] gap-1 bg-blue-500/10 text-blue-600 border-blue-500/30">
                    <Clock className="h-2.5 w-2.5" />
                    {designer.in_progress}
                  </Badge>
                  <Badge variant="outline" className="h-5 text-[10px] gap-1 bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {designer.completed}
                  </Badge>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary/60 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
