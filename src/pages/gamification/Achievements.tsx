import { useState } from "react";
import { Trophy, Star, Lock, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useGamificationBadges } from "@/hooks/useGamificationBadges";
import { SeasonHeader } from "@/components/gamification/SeasonHeader";

type CategoryFilter = 'all' | 'sales' | 'speed' | 'consistency' | 'attendance';

export default function Achievements() {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const { badges, earnedBadges, isLoading } = useGamificationBadges();

  const filteredBadges = category === 'all' 
    ? badges 
    : badges.filter(b => b.category === category);

  const earnedCodes = new Set(earnedBadges.map(eb => eb.badge_code));

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'sales': return 'Vendas';
      case 'speed': return 'Velocidade';
      case 'consistency': return 'Consistência';
      case 'attendance': return 'Atendimento';
      default: return cat;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'sales': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'speed': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'consistency': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'attendance': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-racing-bg">
      <div className="bg-gradient-to-r from-racing-primary/20 to-racing-accent/10 border-b border-racing-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-racing-accent" />
            <div>
              <h1 className="text-2xl font-bold text-white">Conquistas & Badges</h1>
              <p className="text-muted-foreground">
                {earnedBadges.length} de {badges.length} conquistas desbloqueadas
              </p>
            </div>
          </div>
          <Progress 
            value={(earnedBadges.length / Math.max(badges.length, 1)) * 100} 
            className="mt-4 h-2 bg-racing-card"
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filtros por categoria */}
        <Tabs value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
          <TabsList className="bg-racing-card border border-racing-border grid grid-cols-5 w-full max-w-2xl mx-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              Todas
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              Vendas
            </TabsTrigger>
            <TabsTrigger value="speed" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              Velocidade
            </TabsTrigger>
            <TabsTrigger value="consistency" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              Consistência
            </TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-racing-primary data-[state=active]:text-white">
              Atendimento
            </TabsTrigger>
          </TabsList>

          <TabsContent value={category} className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-40 bg-muted/20 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBadges.map((badge) => {
                  const isEarned = earnedCodes.has(badge.code);
                  return (
                    <Card 
                      key={badge.code}
                      className={`relative overflow-hidden transition-all hover:scale-[1.02] ${
                        isEarned 
                          ? 'bg-gradient-to-br from-racing-accent/20 to-racing-primary/10 border-racing-accent/50' 
                          : 'bg-racing-card border-racing-border opacity-60'
                      }`}
                    >
                      {isEarned && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="w-6 h-6 text-racing-accent" />
                        </div>
                      )}
                      {!isEarned && (
                        <div className="absolute top-2 right-2">
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`text-4xl p-3 rounded-xl ${isEarned ? 'bg-racing-accent/20' : 'bg-muted/20'}`}>
                            {badge.icon}
                          </div>
                          <div className="flex-1">
                            <h3 className={`font-bold text-lg ${isEarned ? 'text-white' : 'text-muted-foreground'}`}>
                              {badge.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {badge.description}
                            </p>
                            <Badge 
                              variant="outline" 
                              className={`mt-3 ${getCategoryColor(badge.category)}`}
                            >
                              {getCategoryLabel(badge.category)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {filteredBadges.length === 0 && !isLoading && (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conquista nesta categoria.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
