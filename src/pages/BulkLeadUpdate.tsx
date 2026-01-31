import { useState, useEffect } from 'react';
import { FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { BulkUpdateUploader } from '@/components/bulk-update/BulkUpdateUploader';
import { BulkUpdatePreview } from '@/components/bulk-update/BulkUpdatePreview';
import { BulkUpdateResults } from '@/components/bulk-update/BulkUpdateResults';
import { 
  useBulkLeadUpdate, 
  BulkUpdateRow, 
  MatchedRow, 
  BulkUpdateOptions,
  BulkUpdateResult 
} from '@/hooks/useBulkLeadUpdate';

type Step = 'upload' | 'preview' | 'result';

export default function BulkLeadUpdate() {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [result, setResult] = useState<BulkUpdateResult | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  const {
    loadProfiles,
    processAndMatch,
    updateLeadsAsync,
    isUpdating,
  } = useBulkLeadUpdate();

  // Carregar perfis ao montar
  useEffect(() => {
    loadProfiles();
  }, []);

  const handleDataParsed = (parsedHeaders: string[], parsedRows: Record<string, string>[]) => {
    setHeaders(parsedHeaders);
    setRows(parsedRows);
    setStep('preview');
  };

  const handleMatch = async (processedRows: BulkUpdateRow[]): Promise<MatchedRow[]> => {
    setIsMatching(true);
    try {
      const matched = await processAndMatch(processedRows);
      setMatchedRows(matched);
      return matched;
    } finally {
      setIsMatching(false);
    }
  };

  const handleProcess = async (validRows: MatchedRow[], options: BulkUpdateOptions) => {
    const updateResult = await updateLeadsAsync({ rows: validRows, options });
    setResult(updateResult);
    setStep('result');
  };

  const handleBack = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMatchedRows([]);
  };

  const handleNewImport = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMatchedRows([]);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/crm">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Atualização em Massa</h1>
              <p className="text-sm text-muted-foreground">
                Atualize leads a partir de planilhas do Bling
              </p>
            </div>
          </div>
        </div>

        {/* Steps Indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            1. Upload
          </div>
          <div className="w-8 h-px bg-border" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${step === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            2. Preview
          </div>
          <div className="w-8 h-px bg-border" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${step === 'result' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            3. Resultado
          </div>
        </div>

        {/* Content */}
        {step === 'upload' && (
          <BulkUpdateUploader onDataParsed={handleDataParsed} />
        )}

        {step === 'preview' && (
          <BulkUpdatePreview
            headers={headers}
            rows={rows}
            matchedRows={matchedRows}
            onProcess={handleProcess}
            onBack={handleBack}
            onMatch={handleMatch}
            isMatching={isMatching}
            isUpdating={isUpdating}
          />
        )}

        {step === 'result' && result && (
          <BulkUpdateResults
            result={result}
            onNewImport={handleNewImport}
          />
        )}
      </div>
    </div>
  );
}
