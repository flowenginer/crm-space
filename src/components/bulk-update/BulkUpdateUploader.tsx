import { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface BulkUpdateUploaderProps {
  onDataParsed: (headers: string[], rows: Record<string, string>[]) => void;
  isLoading?: boolean;
}

export function BulkUpdateUploader({ onDataParsed, isLoading }: BulkUpdateUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const parseExcel = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON (array de arrays)
    const jsonData = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, { 
      header: 1, 
      defval: '' 
    });
    
    if (jsonData.length < 2) {
      throw new Error('Arquivo vazio ou sem dados');
    }
    
    const headers = (jsonData[0] as (string | number | null)[]).map(h => String(h || ''));
    const rows = jsonData.slice(1).map(row => {
      const rowData = row as (string | number | null)[];
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = String(rowData[index] ?? '');
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v.trim()));
    
    return { headers, rows };
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Arquivo vazio ou sem dados');
    }
    
    // Detectar separador (vírgula, ponto-e-vírgula ou tab)
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
    
    const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v.trim()));
    
    return { headers, rows };
  };

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    
    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      let result: { headers: string[]; rows: Record<string, string>[] };
      
      if (ext === 'xlsx' || ext === 'xls') {
        result = await parseExcel(selectedFile);
      } else if (ext === 'csv') {
        result = await parseCSV(selectedFile);
      } else {
        throw new Error('Formato não suportado. Use Excel (.xlsx, .xls) ou CSV.');
      }
      
      console.log('[BulkUpdate] Parsed data:', { headers: result.headers, rowCount: result.rows.length });
      onDataParsed(result.headers, result.rows);
      toast.success(`${result.rows.length} linhas carregadas`);
    } catch (error: any) {
      console.error('Parse error:', error);
      toast.error(error.message || 'Erro ao processar arquivo');
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  }, [onDataParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  if (isParsing || isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Processando arquivo...</p>
        </CardContent>
      </Card>
    );
  }

  if (file) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={clearFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload de Arquivo</CardTitle>
        <CardDescription>
          Faça upload de um arquivo Excel ou CSV exportado do Bling
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-12
            flex flex-col items-center justify-center gap-4
            transition-colors cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          `}
        >
          <Upload className={`h-12 w-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-center">
            <p className="text-lg font-medium">Arraste seu arquivo aqui</p>
            <p className="text-sm text-muted-foreground mt-1">
              ou clique para selecionar
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: Excel (.xlsx, .xls), CSV
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleInputChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      </CardContent>
    </Card>
  );
}
