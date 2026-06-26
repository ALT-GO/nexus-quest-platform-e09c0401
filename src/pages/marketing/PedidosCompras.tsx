import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrdersBoard } from "@/components/purchase-orders/PurchaseOrdersBoard";

export default function PedidosComprasMarketing() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <PageHeader
          title="Pedidos de Compras — Marketing"
          description="Controle das solicitações e pedidos de compras enviados ao setor de Compras pelo time de Marketing."
        />
        <PurchaseOrdersBoard department="Marketing" />
      </div>
    </AppLayout>
  );
}
