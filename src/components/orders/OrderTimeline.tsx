import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileEdit, 
  Clock, 
  CheckCircle, 
  Package, 
  Truck, 
  Home,
  XCircle,
  CreditCard 
} from 'lucide-react';
import { Order } from '@/hooks/useOrders';

interface OrderTimelineProps {
  order: Order;
}

interface TimelineEvent {
  icon: typeof Clock;
  label: string;
  date: string | null;
  color: string;
  completed: boolean;
}

const statusOrder = ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  draft: { icon: FileEdit, label: 'Rascunho criado', color: 'text-slate-500' },
  pending: { icon: Clock, label: 'Pedido pendente', color: 'text-amber-500' },
  confirmed: { icon: CheckCircle, label: 'Pedido confirmado', color: 'text-blue-500' },
  processing: { icon: Package, label: 'Em processamento', color: 'text-purple-500' },
  shipped: { icon: Truck, label: 'Enviado', color: 'text-cyan-500' },
  delivered: { icon: Home, label: 'Entregue', color: 'text-emerald-500' },
  canceled: { icon: XCircle, label: 'Cancelado', color: 'text-rose-500' },
};

export function OrderTimeline({ order }: OrderTimelineProps) {
  const currentStatusIndex = statusOrder.indexOf(order.status);

  const events: TimelineEvent[] = [
    {
      icon: FileEdit,
      label: 'Pedido criado',
      date: order.created_at,
      color: 'text-primary',
      completed: true,
    },
  ];

  // Adicionar eventos baseados no status atual
  statusOrder.forEach((status, index) => {
    if (index <= currentStatusIndex || status === order.status) {
      const config = statusConfig[status];
      events.push({
        icon: config.icon,
        label: config.label,
        date: index <= currentStatusIndex ? order.updated_at : null,
        color: config.color,
        completed: index <= currentStatusIndex,
      });
    }
  });

  // Adicionar evento de pagamento se pago
  if (order.paid_at) {
    events.splice(2, 0, {
      icon: CreditCard,
      label: 'Pagamento recebido',
      date: order.paid_at,
      color: 'text-emerald-500',
      completed: true,
    });
  }

  // Adicionar evento de cancelamento
  if (order.status === 'canceled' && order.canceled_at) {
    events.push({
      icon: XCircle,
      label: order.canceled_reason ? `Cancelado: ${order.canceled_reason}` : 'Cancelado',
      date: order.canceled_at,
      color: 'text-rose-500',
      completed: true,
    });
  }

  // Adicionar evento de entrega
  if (order.delivered_at) {
    events.push({
      icon: Home,
      label: 'Pedido entregue',
      date: order.delivered_at,
      color: 'text-emerald-500',
      completed: true,
    });
  }

  return (
    <div className="space-y-1">
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <div key={index} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`p-1.5 rounded-full ${event.completed ? 'bg-muted' : 'bg-muted/50'}`}>
                <Icon className={`h-4 w-4 ${event.completed ? event.color : 'text-muted-foreground'}`} />
              </div>
              {index < events.length - 1 && (
                <div className={`w-0.5 h-8 ${event.completed ? 'bg-primary/30' : 'bg-muted'}`} />
              )}
            </div>
            <div className="flex-1 pb-4">
              <p className={`text-sm font-medium ${event.completed ? '' : 'text-muted-foreground'}`}>
                {event.label}
              </p>
              {event.date && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(event.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
