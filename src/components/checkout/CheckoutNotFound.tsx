import { FileQuestion } from "lucide-react";

export function CheckoutNotFound() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
      <div className="mx-auto h-20 w-20 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center mb-6">
        <FileQuestion className="h-10 w-10 text-white" />
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        Link não encontrado
      </h2>

      <p className="text-slate-500 mb-6">
        O link de pagamento que você está tentando acessar não existe ou foi removido.
      </p>

      <div className="p-4 bg-slate-50 rounded-xl">
        <p className="text-sm text-slate-600">
          Verifique se o link está correto ou entre em contato com o vendedor.
        </p>
      </div>
    </div>
  );
}
