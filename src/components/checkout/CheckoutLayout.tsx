import { ReactNode } from "react";
import { Shield, Lock } from "lucide-react";

interface CheckoutLayoutProps {
  children: ReactNode;
  companyName?: string | null;
  logoUrl?: string | null;
}

export function CheckoutLayout({ children, companyName, logoUrl }: CheckoutLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-center gap-3">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={companyName || "Logo"} 
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {companyName?.charAt(0) || "P"}
              </span>
            </div>
          )}
          {companyName && (
            <span className="font-semibold text-lg text-slate-800">
              {companyName}
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 text-slate-500 text-sm">
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4" />
                <span>Conexão segura</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                <span>Dados protegidos</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Pagamento processado pela Rede
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
