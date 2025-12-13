import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Settings as SettingsIcon } from 'lucide-react';
import { OrderStatusManagement } from '@/components/orders/OrderStatusManagement';
import { PermissionGate } from '@/components/PermissionGate';

export default function OrderSettings() {
  return (
    <PermissionGate permission="orders.manage_settings" showLock>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Configurações de Pedidos
          </h1>
          <p className="text-muted-foreground">
            Configure os status, métodos de pagamento e envio dos pedidos.
          </p>
        </div>

        <Tabs defaultValue="statuses" className="space-y-6">
          <TabsList>
            <TabsTrigger value="statuses" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="statuses">
            <Card>
              <CardHeader>
                <CardTitle>Status de Pedidos</CardTitle>
                <CardDescription>
                  Gerencie os status disponíveis para os pedidos. Você pode criar, editar, reordenar e desativar status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OrderStatusManagement />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
