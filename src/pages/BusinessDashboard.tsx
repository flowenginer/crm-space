import { useState } from 'react';
import { startOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { 
  useMarketingKPIs, 
  useCommercialKPIs, 
  useCustomerSuccessKPIs, 
  useFinancialKPIs,
  useHRKPIs,
  type BusinessKPIFilters 
} from '@/hooks/useBusinessKPIs';
import { AdvancedFilters } from '@/components/dashboard/AdvancedFilters';
import { useAgentsForFilter, useDepartmentsForFilter } from '@/hooks/useDashboardAdvanced';

// KPI Components
import { MarketingKPISection } from '@/components/business-kpis/MarketingKPISection';
import { CommercialKPISection } from '@/components/business-kpis/CommercialKPISection';
import { CustomerSuccessKPISection } from '@/components/business-kpis/CustomerSuccessKPISection';
import { FinancialKPISection } from '@/components/business-kpis/FinancialKPISection';
import { HRKPISection } from '@/components/business-kpis/HRKPISection';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Megaphone, 
  ShoppingCart, 
  Heart, 
  DollarSign, 
  Users 
} from 'lucide-react';

export default function BusinessDashboard() {
  const { profile } = useAuth();
  
  const [filters, setFilters] = useState<BusinessKPIFilters>({
    dateFrom: startOfMonth(new Date()),
    dateTo: new Date(),
    agentId: undefined,
    departmentId: undefined,
    channelId: undefined,
  });

  // Fetch KPIs
  const { data: marketingData, isLoading: loadingMarketing } = useMarketingKPIs(filters);
  const { data: commercialData, isLoading: loadingCommercial } = useCommercialKPIs(filters);
  const { data: customerSuccessData, isLoading: loadingCustomerSuccess } = useCustomerSuccessKPIs(filters);
  const { data: financialData, isLoading: loadingFinancial } = useFinancialKPIs(filters);
  const { data: hrData, isLoading: loadingHR } = useHRKPIs(filters);

  // Filter options
  const { data: agents = [] } = useAgentsForFilter(filters.departmentId);
  const { data: departments = [] } = useDepartmentsForFilter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Indicadores de Negócio
          {profile?.full_name ? ` - ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe os KPIs de Marketing, Comercial, Sucesso do Cliente, Financeiro e RH
        </p>
      </div>

      {/* Filters */}
      <div className="animate-fade-in">
        <AdvancedFilters
          filters={filters}
          onFiltersChange={setFilters}
          agents={agents}
          departments={departments}
        />
      </div>

      {/* KPI Tabs */}
      <Tabs defaultValue="marketing" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger 
            value="marketing" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Marketing</span>
          </TabsTrigger>
          <TabsTrigger 
            value="commercial"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Comercial</span>
          </TabsTrigger>
          <TabsTrigger 
            value="customer-success"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Sucesso</span>
          </TabsTrigger>
          <TabsTrigger 
            value="financial"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Financeiro</span>
          </TabsTrigger>
          <TabsTrigger 
            value="hr"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">RH</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketing" className="animate-fade-in">
          <MarketingKPISection data={marketingData} isLoading={loadingMarketing} />
        </TabsContent>

        <TabsContent value="commercial" className="animate-fade-in">
          <CommercialKPISection data={commercialData} isLoading={loadingCommercial} />
        </TabsContent>

        <TabsContent value="customer-success" className="animate-fade-in">
          <CustomerSuccessKPISection data={customerSuccessData} isLoading={loadingCustomerSuccess} />
        </TabsContent>

        <TabsContent value="financial" className="animate-fade-in">
          <FinancialKPISection data={financialData} isLoading={loadingFinancial} />
        </TabsContent>

        <TabsContent value="hr" className="animate-fade-in">
          <HRKPISection data={hrData} isLoading={loadingHR} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
