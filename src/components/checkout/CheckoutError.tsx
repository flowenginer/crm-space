import { XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckoutErrorProps {
  message: string;
  onRetry: () => void;
}

export function CheckoutError({ message, onRetry }: CheckoutErrorProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
      <div className="mx-auto h-20 w-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mb-6">
        <XCircle className="h-10 w-10 text-white" />
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        Pagamento não aprovado
      </h2>

      <p className="text-slate-500 mb-6">
        {message || "Ocorreu um erro ao processar seu pagamento."}
      </p>

      <div className="space-y-3">
        <Button
          size="lg"
          className="w-full btn-gradient text-white font-semibold h-12"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-5 w-5" />
          Tentar novamente
        </Button>

        <p className="text-xs text-slate-400">
          Verifique os dados do cartão e tente novamente
        </p>
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left">
        <p className="text-sm font-medium text-slate-700 mb-2">Possíveis motivos:</p>
        <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
          <li>Dados do cartão incorretos</li>
          <li>Cartão sem limite disponível</li>
          <li>Cartão bloqueado ou vencido</li>
          <li>Transação não autorizada pelo banco</li>
        </ul>
      </div>
    </div>
  );
}
