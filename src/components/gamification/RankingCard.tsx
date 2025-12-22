import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RankingCardProps {
  title: string;
  icon: LucideIcon;
  value: string;
  leader: string;
  color: string;
}

export function RankingCard({ title, icon: Icon, value, leader, color }: RankingCardProps) {
  return (
    <Card className="bg-racing-card border-racing-border hover:border-racing-accent/50 transition-all hover:scale-[1.02]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg bg-racing-bg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        <div className="space-y-1">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>🥇</span>
            <span className="text-white font-medium">{leader}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
