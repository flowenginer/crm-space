import { Loader2, Clock, UserPlus, DollarSign, MessageSquare } from 'lucide-react';

interface Activity {
  id: string;
  text: string;
  time: string;
  type: string;
}

interface RecentActivityProps {
  data: Activity[];
  isLoading?: boolean;
}

export function RecentActivity({ data, isLoading }: RecentActivityProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-4">Atividade Recente</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <h3 className="text-lg font-semibold text-foreground mb-4">Atividade Recente</h3>
      
      {data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Nenhuma atividade recente</p>
          <p className="text-sm mt-1">As atividades aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-center gap-4 p-3 hover:bg-muted/50 rounded-xl transition-colors cursor-pointer"
            >
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                {activity.type === 'contact' ? (
                  <UserPlus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                ) : activity.type === 'deal' ? (
                  <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                ) : (
                  <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{activity.text}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
              <div className="h-2.5 w-2.5 bg-success rounded-full animate-pulse"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
