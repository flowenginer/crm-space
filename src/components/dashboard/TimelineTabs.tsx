import { Calendar, Clock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TimelineChart } from './TimelineChart';
import { HourlyChart } from './HourlyChart';
import type { TimelineData, HourlyData } from '@/hooks/useDashboardAdvanced';

interface TimelineTabsProps {
  dailyData: TimelineData[];
  hourlyData: HourlyData[];
  isLoadingDaily?: boolean;
  isLoadingHourly?: boolean;
}

export function TimelineTabs({ 
  dailyData, 
  hourlyData, 
  isLoadingDaily, 
  isLoadingHourly 
}: TimelineTabsProps) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <Tabs defaultValue="daily" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Timeline</h3>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="daily" className="gap-1.5 data-[state=active]:bg-background">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Por Dia</span>
            </TabsTrigger>
            <TabsTrigger value="hourly" className="gap-1.5 data-[state=active]:bg-background">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Por Hora</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="daily" className="mt-0">
          <TimelineChart data={dailyData} isLoading={isLoadingDaily} showCard={false} />
        </TabsContent>

        <TabsContent value="hourly" className="mt-0">
          <HourlyChart data={hourlyData} isLoading={isLoadingHourly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}