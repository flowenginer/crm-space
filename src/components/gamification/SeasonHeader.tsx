import { Flag, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

type PeriodFilter = 'daily' | 'weekly' | 'monthly';

interface SeasonHeaderProps {
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
}

export function SeasonHeader({ period, onPeriodChange }: SeasonHeaderProps) {
  const currentDate = new Date();
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
  const year = currentDate.getFullYear();

  return (
    <div className="bg-gradient-to-r from-racing-primary/30 via-racing-bg to-racing-accent/20 border-b border-racing-border">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Título da Temporada */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Flag className="w-10 h-10 text-racing-accent animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-racing-primary rounded-full animate-ping" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                🏁 SPACE RACING
              </h1>
              <p className="text-racing-accent font-semibold uppercase tracking-widest">
                Temporada {monthName} {year}
              </p>
            </div>
          </div>

          {/* Filtros de Período */}
          <div className="flex items-center gap-2 bg-racing-card/50 p-1 rounded-lg border border-racing-border">
            <Button
              variant={period === 'daily' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPeriodChange('daily')}
              className={period === 'daily' ? 'bg-racing-primary hover:bg-racing-primary/90' : 'text-muted-foreground hover:text-white'}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Hoje
            </Button>
            <Button
              variant={period === 'weekly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPeriodChange('weekly')}
              className={period === 'weekly' ? 'bg-racing-primary hover:bg-racing-primary/90' : 'text-muted-foreground hover:text-white'}
            >
              Semana
            </Button>
            <Button
              variant={period === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPeriodChange('monthly')}
              className={period === 'monthly' ? 'bg-racing-primary hover:bg-racing-primary/90' : 'text-muted-foreground hover:text-white'}
            >
              Mês
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
