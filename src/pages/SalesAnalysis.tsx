import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SalesReport } from "@/components/sales/SalesReport";

interface SalesResult {
  totalOrders: number;
  matchedOrders: number;
  unmatchedOrders: number;
  convertedOrders: number;
  notConvertedInCRM: number;
  totalRevenue: number;
  summary: Record<string, { count: number; total: number }>;
  creativeSummary: Record<string, { count: number; total: number; origem: string }>;
  orders: Array<{
    pedido: string;
    nomeComprador: string;
    telefone: string;
    totalPedido: number;
    matchCRM: boolean;
    nomeCRM: string | null;
    origem: string;
    criativo: string | null;
    originCampaign: string | null;
    convertidoCRM: boolean;
  }>;
}

export default function SalesAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SalesResult | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const csvText = await file.text();

      // Get tenant_id from profile
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.tenant_id) {
        toast.error("Tenant não encontrado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("cross-reference-sales", {
        body: { csvText, tenantId: profile.tenant_id },
      });

      if (error) throw error;
      setResult(data);
      toast.success(`${data.totalOrders} pedidos processados, ${data.matchedOrders} encontrados no CRM`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar: " + (err.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Análise de Vendas x CRM</h1>
          <p className="text-muted-foreground text-sm">
            Faça upload da planilha de vendas para cruzar com os dados do CRM
          </p>
        </div>
      </div>

      {!result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload do CSV de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Processando CSV e cruzando com CRM...</span>
                  <span className="text-xs text-muted-foreground">Isso pode levar alguns segundos</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV</span>
                  <span className="text-xs text-muted-foreground">Formato: exportação de vendas com "Celular Comprador"</span>
                </div>
              )}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
                disabled={loading}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setResult(null)}>
              <Upload className="h-4 w-4 mr-2" />
              Novo upload
            </Button>
          </div>
          <SalesReport data={result} />
        </>
      )}
    </div>
  );
}
