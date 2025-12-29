import { CheckCircle, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

interface CheckoutSuccessProps {
  amount: number;
  transactionId?: string;
  authorizationCode?: string;
  alreadyPaid?: boolean;
}

export function CheckoutSuccess({ 
  amount, 
  transactionId, 
  authorizationCode,
  alreadyPaid = false 
}: CheckoutSuccessProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (transactionId) {
      navigator.clipboard.writeText(transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
      <div className="mx-auto h-20 w-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="h-10 w-10 text-white" />
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        {alreadyPaid ? "Pagamento já realizado!" : "Pagamento aprovado!"}
      </h2>

      <p className="text-slate-500 mb-6">
        {alreadyPaid 
          ? "Este link de pagamento já foi utilizado anteriormente."
          : "Seu pagamento foi processado com sucesso."
        }
      </p>

      <div className="bg-slate-50 rounded-xl p-4 mb-6">
        <p className="text-sm text-slate-500 mb-1">Valor pago</p>
        <p className="text-3xl font-bold text-green-600">{formatCurrency(amount)}</p>
      </div>

      {transactionId && (
        <div className="space-y-3 text-left bg-slate-50 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">ID da transação</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-slate-700">{transactionId}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>
          </div>
          
          {authorizationCode && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Código de autorização</span>
              <span className="font-mono text-sm text-slate-700">{authorizationCode}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-6">
        Você receberá um comprovante por e-mail ou WhatsApp
      </p>
    </div>
  );
}
