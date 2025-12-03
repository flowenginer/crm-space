import { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Download,
  FileText,
  Clock,
  MessageSquare,
  DollarSign,
  Smile,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  PhoneIncoming,
  PhoneOutgoing,
  Target,
  ShoppingBag,
  Star,
  ShoppingCart,
  Package,
  Headphones,
  Truck,
  Receipt,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Mock data
const slaTimelineData = [
  { date: '25/11', bom: 320, regular: 110, critico: 780 },
  { date: '26/11', bom: 410, regular: 95, critico: 650 },
  { date: '27/11', bom: 380, regular: 120, critico: 720 },
  { date: '28/11', bom: 450, regular: 85, critico: 580 },
  { date: '29/11', bom: 520, regular: 70, critico: 490 },
  { date: '30/11', bom: 480, regular: 95, critico: 540 },
  { date: '01/12', bom: 550, regular: 65, critico: 420 },
  { date: '02/12', bom: 620, regular: 55, critico: 380 },
  { date: '03/12', bom: 680, regular: 45, critico: 350 },
];

const slaPieData = [
  { name: 'Bom', value: 9372, fill: '#10B981' },
  { name: 'Regular', value: 3032, fill: '#F59E0B' },
  { name: 'Crítico', value: 21633, fill: '#EF4444' },
];

const departmentTMAData = [
  { name: 'Expedição', value: 35818, percentage: 100 },
  { name: 'Pós-Vendas', value: 34926, percentage: 97 },
  { name: 'SAC', value: 28876, percentage: 80 },
  { name: 'Financeiro', value: 22451, percentage: 62 },
  { name: 'Vendas', value: 18234, percentage: 50 },
];

const slaAgentData = [
  { name: 'Diego', total: 1234, bom: 890, regular: 210, critico: 134, tma: 45, slaGood: 72 },
  { name: 'Ian', total: 1156, bom: 756, regular: 245, critico: 155, tma: 52, slaGood: 65 },
  { name: 'Lara', total: 987, bom: 720, regular: 180, critico: 87, tma: 38, slaGood: 73 },
  { name: 'Michel', total: 876, bom: 540, regular: 200, critico: 136, tma: 61, slaGood: 62 },
  { name: 'Ricardo', total: 654, bom: 480, regular: 120, critico: 54, tma: 42, slaGood: 73 },
];

const channelData = [
  { channel: 'Vendas 01', value: 145 },
  { channel: 'Vendas 02', value: 132 },
  { channel: 'Vendas 03', value: 98 },
  { channel: 'Vendas 05', value: 87 },
  { channel: 'Vendas 06', value: 65 },
  { channel: 'Vendas 07', value: 45 },
];

const hourlyData = [
  { hour: '08h', value: 12 },
  { hour: '09h', value: 45 },
  { hour: '10h', value: 78 },
  { hour: '11h', value: 92 },
  { hour: '12h', value: 45 },
  { hour: '13h', value: 38 },
  { hour: '14h', value: 85 },
  { hour: '15h', value: 98 },
  { hour: '16h', value: 76 },
  { hour: '17h', value: 54 },
  { hour: '18h', value: 32 },
];

const funnelData = [
  { stage: 'Leads', value: 1056, percentage: 100 },
  { stage: 'Qualificados', value: 524, percentage: 49.6 },
  { stage: 'Proposta Enviada', value: 312, percentage: 29.5 },
  { stage: 'Negociação', value: 156, percentage: 14.8 },
  { stage: 'Fechados', value: 37, percentage: 3.5 },
];

const productSalesData = [
  { name: 'Manga Curta UV50+', value: 15200 },
  { name: 'Manga Longa UV50+', value: 12800 },
  { name: 'Manga Longa Zíper', value: 9500 },
  { name: 'Regata UV50+', value: 4200 },
  { name: 'Outros', value: 3500 },
];

const salesTimelineData = [
  { date: '25/11', vendas: 3200, meta: 4000, quantidade: 3 },
  { date: '26/11', vendas: 4500, meta: 4000, quantidade: 5 },
  { date: '27/11', vendas: 3800, meta: 4000, quantidade: 4 },
  { date: '28/11', vendas: 5200, meta: 4000, quantidade: 6 },
  { date: '29/11', vendas: 6100, meta: 4000, quantidade: 7 },
  { date: '30/11', vendas: 4800, meta: 4000, quantidade: 5 },
  { date: '01/12', vendas: 7200, meta: 5000, quantidade: 8 },
  { date: '02/12', vendas: 5600, meta: 5000, quantidade: 6 },
  { date: '03/12', vendas: 4800, meta: 5000, quantidade: 5 },
];

const topSellersData = [
  { rank: 1, name: 'Diego', sales: 12, revenue: 14520, ticket: 1210, conversion: 28 },
  { rank: 2, name: 'Lara', sales: 10, revenue: 12800, ticket: 1280, conversion: 25 },
  { rank: 3, name: 'Ian', sales: 8, revenue: 9600, ticket: 1200, conversion: 22 },
  { rank: 4, name: 'Michel', sales: 5, revenue: 5800, ticket: 1160, conversion: 18 },
  { rank: 5, name: 'Ricardo', sales: 2, revenue: 2480, ticket: 1240, conversion: 15 },
];

const npsDistributionData = [
  { score: 1, count: 5 },
  { score: 2, count: 8 },
  { score: 3, count: 12 },
  { score: 4, count: 15 },
  { score: 5, count: 25 },
  { score: 6, count: 30 },
  { score: 7, count: 45 },
  { score: 8, count: 78 },
  { score: 9, count: 120 },
  { score: 10, count: 180 },
];

const emojiRatingsData = [
  { emoji: '😍', label: 'Muito Satisfeito', count: 234, percentage: 45 },
  { emoji: '😊', label: 'Satisfeito', count: 156, percentage: 30 },
  { emoji: '😐', label: 'Neutro', count: 78, percentage: 15 },
  { emoji: '😕', label: 'Insatisfeito', count: 36, percentage: 7 },
  { emoji: '😡', label: 'Muito Insatisfeito', count: 16, percentage: 3 },
];

const recentFeedback = [
  { name: 'João Silva', rating: 10, comment: 'Excelente atendimento! Muito rápido e eficiente.', date: '03/12/2025 15:30', agent: 'Diego' },
  { name: 'Maria Santos', rating: 9, comment: 'Muito satisfeita com a qualidade das camisas e o prazo de entrega.', date: '03/12/2025 14:15', agent: 'Lara' },
  { name: 'Pedro Costa', rating: 8, comment: 'Bom atendimento, mas poderia ser um pouco mais rápido.', date: '03/12/2025 11:45', agent: 'Ian' },
  { name: 'Ana Oliveira', rating: 5, comment: 'Demorou muito para responder minha dúvida inicial.', date: '02/12/2025 16:20', agent: 'Michel' },
];

const radarData = [
  { metric: 'Atendimentos', Diego: 85, Media: 70 },
  { metric: 'Vendas', Diego: 78, Media: 65 },
  { metric: 'SLA', Diego: 72, Media: 60 },
  { metric: 'NPS', Diego: 85, Media: 72 },
  { metric: 'Tempo Resposta', Diego: 90, Media: 75 },
  { metric: 'Resolução', Diego: 82, Media: 68 },
];

const weeklyPerformanceData = [
  { week: 'Sem 1', atendimentos: 280, vendas: 2, sla: 68 },
  { week: 'Sem 2', atendimentos: 310, vendas: 3, sla: 70 },
  { week: 'Sem 3', atendimentos: 295, vendas: 4, sla: 72 },
  { week: 'Sem 4', atendimentos: 349, vendas: 3, sla: 75 },
];

const goalsData = [
  { label: 'Atendimentos', current: 1234, goal: 1500, unit: '' },
  { label: 'Vendas', current: 12, goal: 15, unit: '' },
  { label: 'Faturamento', current: 14520, goal: 20000, unit: 'R$' },
  { label: 'SLA Bom', current: 72, goal: 80, unit: '%' },
];

const recentActivities = [
  { time: '15:30', action: 'Finalizou atendimento', detail: 'Fernando TR - Venda R$ 899,00', type: 'sale' },
  { time: '15:15', action: 'Enviou proposta', detail: 'João Silva - 50 camisas manga curta', type: 'proposal' },
  { time: '14:45', action: 'Iniciou atendimento', detail: 'Maria Santos - Dúvida sobre tamanhos', type: 'chat' },
  { time: '14:20', action: 'Recebeu avaliação', detail: 'NPS 10 - "Excelente atendimento"', type: 'feedback' },
  { time: '13:50', action: 'Transferiu atendimento', detail: 'Para Lara - Setor financeiro', type: 'transfer' },
];

const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#6B7280'];

export default function Reports() {
  const [selectedAgent, setSelectedAgent] = useState('Diego');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Relatórios</h1>
          <p className="text-muted-foreground">
            Análise completa do desempenho da sua equipe
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl shadow-sm">
            <Calendar size={18} className="text-muted-foreground" />
            <span className="text-sm text-foreground">01/12/2025 - 03/12/2025</span>
            <ChevronDown size={16} className="text-muted-foreground" />
          </div>

          {/* Export Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all">
                <Download size={18} />
                Exportar
                <ChevronDown size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="flex items-center gap-2">
                <FileText size={16} />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <FileText size={16} />
                Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <FileText size={16} />
                Exportar CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sla" className="w-full">
        <TabsList className="bg-card border border-border rounded-xl p-1 shadow-sm w-full flex mb-6">
          <TabsTrigger
            value="sla"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Clock size={18} />
            SLA
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <MessageSquare size={18} />
            Atendimentos
          </TabsTrigger>
          <TabsTrigger
            value="sales"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <DollarSign size={18} />
            Vendas
          </TabsTrigger>
          <TabsTrigger
            value="satisfaction"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Smile size={18} />
            Satisfação
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Users size={18} />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SLA Report */}
        <TabsContent value="sla" className="space-y-6">
          {/* SLA Metric Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">SLA Bom</span>
                <div className="p-2 bg-status-success/10 rounded-lg">
                  <CheckCircle size={20} className="text-status-success" />
                </div>
              </div>
              <div className="text-3xl font-bold text-status-success mb-1">9.372</div>
              <div className="text-sm text-muted-foreground">atendimentos</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">SLA Regular</span>
                <div className="p-2 bg-status-warning/10 rounded-lg">
                  <AlertTriangle size={20} className="text-status-warning" />
                </div>
              </div>
              <div className="text-3xl font-bold text-status-warning mb-1">3.032</div>
              <div className="text-sm text-muted-foreground">atendimentos</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">SLA Crítico</span>
                <div className="p-2 bg-status-error/10 rounded-lg">
                  <XCircle size={20} className="text-status-error" />
                </div>
              </div>
              <div className="text-3xl font-bold text-status-error mb-1">21.633</div>
              <div className="text-sm text-muted-foreground">atendimentos</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">TMA Geral</span>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock size={20} className="text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">12.199</div>
              <div className="text-sm text-muted-foreground">minutos</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* TMA by Department */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">TMA por Departamento</h3>
              <div className="space-y-4">
                {departmentTMAData.map((dept, idx) => (
                  <div key={dept.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{dept.name}</span>
                      <span className="text-sm font-bold text-foreground">{dept.value.toLocaleString()} min</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${dept.percentage}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Distribution Pie */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Distribuição de SLA</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width={250} height={250}>
                  <PieChart>
                    <Pie
                      data={slaPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {slaPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-status-success rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Bom (27.5%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-status-warning rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Regular (8.9%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-status-error rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Crítico (63.6%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* SLA Timeline */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Evolução do SLA</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={slaTimelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="critico" stackId="1" stroke="#EF4444" fill="#FEE2E2" name="Crítico" />
                <Area type="monotone" dataKey="regular" stackId="1" stroke="#F59E0B" fill="#FEF3C7" name="Regular" />
                <Area type="monotone" dataKey="bom" stackId="1" stroke="#10B981" fill="#D1FAE5" name="Bom" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* SLA Detailed Table */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Detalhamento por Atendente</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atendente</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bom</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regular</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Crítico</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">TMA</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">% SLA Bom</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slaAgentData.map((agent) => (
                  <tr key={agent.name} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-semibold">
                          {agent.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{agent.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-foreground font-medium">{agent.total}</td>
                    <td className="px-6 py-4 text-center text-status-success font-medium">{agent.bom}</td>
                    <td className="px-6 py-4 text-center text-status-warning font-medium">{agent.regular}</td>
                    <td className="px-6 py-4 text-center text-status-error font-medium">{agent.critico}</td>
                    <td className="px-6 py-4 text-center text-foreground">{agent.tma} min</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        agent.slaGood >= 70 ? 'bg-status-success/10 text-status-success' :
                        agent.slaGood >= 50 ? 'bg-status-warning/10 text-status-warning' :
                        'bg-status-error/10 text-status-error'
                      }`}>
                        {agent.slaGood}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 2: Attendance Report */}
        <TabsContent value="attendance" className="space-y-6">
          {/* Attendance Metric Cards */}
          <div className="grid grid-cols-5 gap-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Total</span>
                <MessageSquare size={20} className="text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground">572</div>
              <div className="text-sm text-status-success font-medium mt-1">+12% vs anterior</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Receptivos</span>
                <PhoneIncoming size={20} className="text-status-info" />
              </div>
              <div className="text-3xl font-bold text-foreground">521</div>
              <div className="text-sm text-muted-foreground mt-1">91% do total</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Ativos</span>
                <PhoneOutgoing size={20} className="text-status-success" />
              </div>
              <div className="text-3xl font-bold text-foreground">51</div>
              <div className="text-sm text-muted-foreground mt-1">9% do total</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Pendentes</span>
                <Clock size={20} className="text-status-warning" />
              </div>
              <div className="text-3xl font-bold text-status-warning">257</div>
              <div className="text-sm text-muted-foreground mt-1">aguardando</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Finalizados</span>
                <CheckCircle size={20} className="text-status-success" />
              </div>
              <div className="text-3xl font-bold text-status-success">315</div>
              <div className="text-sm text-muted-foreground mt-1">55% do total</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* By Channel */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Atendimentos por Canal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={channelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By Hour */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Atendimentos por Hora</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* By Department */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Atendimentos por Departamento</h3>
            <div className="grid grid-cols-5 gap-4">
              {[
                { name: 'Vendas', value: 234, Icon: ShoppingCart, bgColor: 'bg-primary/10', iconColor: 'text-primary' },
                { name: 'Pós-Vendas', value: 156, Icon: Package, bgColor: 'bg-status-info/10', iconColor: 'text-status-info' },
                { name: 'Suporte', value: 89, Icon: Headphones, bgColor: 'bg-status-success/10', iconColor: 'text-status-success' },
                { name: 'Financeiro', value: 54, Icon: DollarSign, bgColor: 'bg-status-warning/10', iconColor: 'text-status-warning' },
                { name: 'Expedição', value: 39, Icon: Truck, bgColor: 'bg-status-error/10', iconColor: 'text-status-error' },
              ].map((dept) => (
                <div key={dept.name} className={`${dept.bgColor} rounded-xl p-4 text-center`}>
                  <div className={`w-12 h-12 ${dept.bgColor} rounded-full flex items-center justify-center mx-auto mb-3`}>
                    <dept.Icon size={24} className={dept.iconColor} />
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">{dept.value}</div>
                  <div className="text-sm text-muted-foreground">{dept.name}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Sales Report */}
        <TabsContent value="sales" className="space-y-6">
          {/* Sales Metric Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-6 shadow-lg text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/80 font-medium">Faturamento Total</span>
                <DollarSign size={24} className="text-white/80" />
              </div>
              <div className="text-4xl font-bold mb-1">R$ 45.2K</div>
              <div className="text-sm text-white/70">+18% vs mês anterior</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Taxa de Conversão</span>
                <Target size={20} className="text-status-success" />
              </div>
              <div className="text-3xl font-bold text-foreground">23.5%</div>
              <div className="text-sm text-status-success font-medium mt-1">+2.1% vs anterior</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Ticket Médio</span>
                <Receipt size={20} className="text-status-info" />
              </div>
              <div className="text-3xl font-bold text-foreground">R$ 1.234</div>
              <div className="text-sm text-muted-foreground mt-1">por venda</div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Vendas Fechadas</span>
                <ShoppingBag size={20} className="text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground">37</div>
              <div className="text-sm text-status-success font-medium mt-1">+8 vs semana anterior</div>
            </div>
          </div>

          {/* Funnel and Products */}
          <div className="grid grid-cols-2 gap-6">
            {/* Sales Funnel */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Funil de Conversão</h3>
              <div className="space-y-4">
                {funnelData.map((stage, idx) => (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{stage.stage}</span>
                      <span className="text-sm text-foreground">
                        <strong>{stage.value}</strong>
                        <span className="text-muted-foreground ml-1">({stage.percentage}%)</span>
                      </span>
                    </div>
                    <div className="h-8 bg-muted rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                        style={{
                          width: `${stage.percentage}%`,
                          backgroundColor: idx === funnelData.length - 1 ? '#10B981' : COLORS[idx % COLORS.length],
                        }}
                      >
                        {stage.percentage > 20 && (
                          <span className="text-xs font-bold text-white">{stage.value}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales by Product */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Vendas por Produto</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={productSalesData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    dataKey="value"
                  >
                    {productSalesData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sales Timeline */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Evolução de Vendas</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={salesTimelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Vendas (R$)" />
                <Line yAxisId="left" type="monotone" dataKey="meta" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" name="Meta" />
                <Line yAxisId="right" type="monotone" dataKey="quantidade" stroke="#10B981" strokeWidth={2} name="Quantidade" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Top Sellers */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Ranking de Vendedores</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">#</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Vendedor</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Vendas</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Faturamento</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Ticket Médio</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Conversão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topSellersData.map((seller) => (
                  <tr key={seller.name} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        seller.rank === 1 ? 'bg-status-warning/20 text-status-warning' :
                        seller.rank === 2 ? 'bg-neutral-200 text-neutral-600' :
                        seller.rank === 3 ? 'bg-orange-100 text-orange-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {seller.rank}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                          {seller.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{seller.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-foreground">{seller.sales}</td>
                    <td className="px-6 py-4 text-center font-medium text-status-success">
                      R$ {seller.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center text-foreground">
                      R$ {seller.ticket.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">
                        {seller.conversion}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 4: Satisfaction Report */}
        <TabsContent value="satisfaction" className="space-y-6">
          {/* NPS Score Card */}
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-gradient-to-br from-status-success to-emerald-600 rounded-2xl p-8 shadow-lg text-white">
              <div className="text-center">
                <div className="text-6xl font-bold mb-2">72</div>
                <div className="text-xl font-semibold text-green-100 mb-4">NPS Score</div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full">
                  <TrendingUp size={18} />
                  <span className="font-medium">Excelente</span>
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Distribuição de Respostas</h3>
              <div className="flex items-end justify-between h-48 gap-2">
                {npsDistributionData.map((item) => {
                  const maxCount = Math.max(...npsDistributionData.map(d => d.count));
                  const color = item.score <= 6 ? '#EF4444' : item.score <= 8 ? '#84CC16' : '#10B981';
                  return (
                    <div key={item.score} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80"
                        style={{
                          height: `${(item.count / maxCount) * 100}%`,
                          backgroundColor: color,
                          minHeight: '20px',
                        }}
                      />
                      <span className="text-xs font-medium text-muted-foreground">{item.score}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-xs text-muted-foreground">
                <span>Detratores (0-6)</span>
                <span>Neutros (7-8)</span>
                <span>Promotores (9-10)</span>
              </div>
            </div>
          </div>

          {/* Emoji Ratings */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Avaliação por Emoji</h3>
            <div className="grid grid-cols-5 gap-6">
              {emojiRatingsData.map((item) => {
                const colors: Record<string, string> = {
                  'Muito Satisfeito': 'bg-status-success',
                  'Satisfeito': 'bg-status-info',
                  'Neutro': 'bg-status-warning',
                  'Insatisfeito': 'bg-orange-500',
                  'Muito Insatisfeito': 'bg-status-error',
                };
                return (
                  <div key={item.label} className="text-center">
                    <div className="text-5xl mb-3">{item.emoji}</div>
                    <div className="text-2xl font-bold text-foreground mb-1">{item.count}</div>
                    <div className="text-sm text-muted-foreground mb-2">{item.label}</div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[item.label]} rounded-full`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{item.percentage}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Feedback */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Comentários Recentes</h3>
              <button className="text-sm text-primary hover:text-primary/80 font-medium">
                Ver todos
              </button>
            </div>
            <div className="divide-y divide-border">
              {recentFeedback.map((feedback, idx) => (
                <div key={idx} className="p-6 hover:bg-muted/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                        {feedback.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{feedback.name}</div>
                        <div className="text-xs text-muted-foreground">Atendido por {feedback.agent}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        feedback.rating >= 9 ? 'bg-status-success/10 text-status-success' :
                        feedback.rating >= 7 ? 'bg-status-info/10 text-status-info' :
                        'bg-status-error/10 text-status-error'
                      }`}>
                        {feedback.rating}/10
                      </span>
                      <span className="text-xs text-muted-foreground">{feedback.date}</span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{feedback.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 5: Individual Performance */}
        <TabsContent value="performance" className="space-y-6">
          {/* Agent Selector */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground font-medium">Selecionar atendente:</span>
            <div className="flex gap-2">
              {['Todos', 'Diego', 'Ian', 'Lara', 'Michel', 'Ricardo'].map((agent) => (
                <button
                  key={agent}
                  onClick={() => setSelectedAgent(agent)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    agent === selectedAgent
                      ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                      : 'bg-card border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {agent}
                </button>
              ))}
            </div>
          </div>

          {/* Individual Stats */}
          <div className="grid grid-cols-6 gap-4">
            {[
              { label: 'Atendimentos', value: '1.234', Icon: MessageSquare, bgColor: 'bg-primary/10', iconColor: 'text-primary' },
              { label: 'Vendas', value: '12', Icon: ShoppingBag, bgColor: 'bg-status-success/10', iconColor: 'text-status-success' },
              { label: 'Faturamento', value: 'R$ 14.5K', Icon: DollarSign, bgColor: 'bg-status-info/10', iconColor: 'text-status-info' },
              { label: 'TMA', value: '45 min', Icon: Clock, bgColor: 'bg-status-warning/10', iconColor: 'text-status-warning' },
              { label: 'SLA Bom', value: '72%', Icon: CheckCircle, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
              { label: 'NPS', value: '85', Icon: Star, bgColor: 'bg-accent/10', iconColor: 'text-accent' },
            ].map((stat) => (
              <div key={stat.label} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center mb-3`}>
                  <stat.Icon size={20} className={stat.iconColor} />
                </div>
                <div className="text-xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Radar and Weekly */}
          <div className="grid grid-cols-2 gap-6">
            {/* Radar Chart */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Comparativo de Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Radar name={selectedAgent} dataKey="Diego" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                  <Radar name="Média" dataKey="Media" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Performance */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Evolução Semanal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="atendimentos" stroke="hsl(var(--primary))" strokeWidth={2} name="Atendimentos" />
                  <Line yAxisId="right" type="monotone" dataKey="sla" stroke="#10B981" strokeWidth={2} name="SLA %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Goals Progress */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Metas do Mês</h3>
            <div className="grid grid-cols-4 gap-6">
              {goalsData.map((goal) => {
                const percentage = Math.min((goal.current / goal.goal) * 100, 100);
                return (
                  <div key={goal.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{goal.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {goal.unit}{goal.current.toLocaleString()} / {goal.unit}{goal.goal.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentage >= 100 ? 'bg-status-success' :
                          percentage >= 70 ? 'bg-status-info' :
                          percentage >= 50 ? 'bg-status-warning' :
                          'bg-status-error'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-right mt-1">
                      <span className={`text-xs font-bold ${
                        percentage >= 100 ? 'text-status-success' :
                        percentage >= 70 ? 'text-status-info' :
                        percentage >= 50 ? 'text-status-warning' :
                        'text-status-error'
                      }`}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Atividades Recentes</h3>
            </div>
            <div className="p-6">
              <div className="relative border-l-2 border-border pl-6 space-y-6">
                {recentActivities.map((activity, idx) => {
                  const typeColors: Record<string, string> = {
                    sale: 'bg-status-success',
                    proposal: 'bg-status-info',
                    chat: 'bg-primary',
                    feedback: 'bg-status-warning',
                    transfer: 'bg-muted-foreground',
                  };
                  return (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-[30px] w-4 h-4 rounded-full border-4 border-card ${typeColors[activity.type]}`}></div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-foreground">{activity.action}</div>
                          <div className="text-sm text-muted-foreground">{activity.detail}</div>
                        </div>
                        <span className="text-xs text-muted-foreground">{activity.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
