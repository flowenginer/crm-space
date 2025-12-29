import { Loader2 } from "lucide-react";

export function CheckoutLoading() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
      <div className="mx-auto h-20 w-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mb-6">
        <Loader2 className="h-10 w-10 text-white animate-spin" />
      </div>

      <h2 className="text-xl font-semibold text-slate-800 mb-2">
        Carregando...
      </h2>

      <p className="text-slate-500">
        Buscando informações do pagamento
      </p>
    </div>
  );
}
