import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneCall, PhoneOff, Clock, TrendingUp, TrendingDown, Minus, BarChart3, FileText, Mic } from 'lucide-react';
import { useCallStatistics, useWhatsAppCalls, useNegativeSentimentCalls } from '@/hooks/useWhatsAppCalls';
import { CallDashboard } from '@/components/calls/CallDashboard';
import { CallHistory } from '@/components/calls/CallHistory';
import { SentimentAnalysis } from '@/components/calls/SentimentAnalysis';

export default function CallManagement() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Phone className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Gestão de Ligações</h1>
          <p className="text-muted-foreground">
            Monitore chamadas, gravações, transcrições e análise de sentimento
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Sentimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <CallDashboard />
        </TabsContent>

        <TabsContent value="history">
          <CallHistory />
        </TabsContent>

        <TabsContent value="sentiment">
          <SentimentAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
}
