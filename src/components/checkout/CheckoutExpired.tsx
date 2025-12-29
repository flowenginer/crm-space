import { Clock } from "lucide-react";

export function CheckoutExpired() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
      <div className="mx-auto h-20 w-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mb-6">
        <Clock className="h-10 w-10 text-white" />
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        Link expirado
      </h2>

      <p className="text-slate-500 mb-6">
        Este link de pagamento não está mais disponível.
      </p>

      <div className="p-4 bg-slate-50 rounded-xl">
        <p className="text-sm text-slate-600">
          Entre em contato com o vendedor para solicitar um novo link de pagamento.
        </p>
      </div>
    </div>
  );
}
