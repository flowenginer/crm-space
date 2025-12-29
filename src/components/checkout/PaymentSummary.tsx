import { formatCurrency } from "@/lib/format";
import { Receipt } from "lucide-react";

interface PaymentSummaryProps {
  amount: number;
  description?: string | null;
  customerName?: string | null;
}

export function PaymentSummary({ amount, description, customerName }: PaymentSummaryProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
          <Receipt className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Resumo do Pagamento</h2>
      </div>

      <div className="space-y-3">
        {customerName && (
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-500 text-sm">Cliente</span>
            <span className="font-medium text-slate-800">{customerName}</span>
          </div>
        )}

        {description && (
          <div className="flex justify-between items-start py-2 border-b border-slate-100">
            <span className="text-slate-500 text-sm">Descrição</span>
            <span className="font-medium text-slate-800 text-right max-w-[60%]">{description}</span>
          </div>
        )}

        <div className="flex justify-between items-center py-3 bg-slate-50 rounded-lg px-4 -mx-1">
          <span className="text-slate-600 font-medium">Total a pagar</span>
          <span className="text-2xl font-bold text-primary">{formatCurrency(amount)}</span>
        </div>
      </div>
    </div>
  );
}
