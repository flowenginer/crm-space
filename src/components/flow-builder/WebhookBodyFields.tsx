import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Variáveis disponíveis do contato
const CONTACT_VARIABLES = [
  { value: '{{full_name}}', label: 'Nome completo' },
  { value: '{{phone}}', label: 'Telefone' },
  { value: '{{email}}', label: 'E-mail' },
  { value: '{{cpf_cnpj}}', label: 'CPF/CNPJ' },
  { value: '{{birth_date}}', label: 'Data de nascimento' },
  { value: '{{zip_code}}', label: 'CEP' },
  { value: '{{street}}', label: 'Rua' },
  { value: '{{number}}', label: 'Número' },
  { value: '{{complement}}', label: 'Complemento' },
  { value: '{{neighborhood}}', label: 'Bairro' },
  { value: '{{city}}', label: 'Cidade' },
  { value: '{{state}}', label: 'Estado' },
  { value: '{{country}}', label: 'País' },
  { value: '{{lead_status}}', label: 'Status do lead' },
  { value: '{{origin}}', label: 'Origem' },
  { value: '{{notes}}', label: 'Observações' },
  { value: '{{lead_score}}', label: 'Pontuação' },
  { value: '{{negotiated_value}}', label: 'Valor negociado' },
];

export interface BodyField {
  id: string;
  key: string;
  type: 'fixed' | 'variable';
  value: string;
}

interface WebhookBodyFieldsProps {
  fields: BodyField[];
  onChange: (fields: BodyField[]) => void;
}

export function WebhookBodyFields({ fields, onChange }: WebhookBodyFieldsProps) {
  const addField = () => {
    const newField: BodyField = {
      id: crypto.randomUUID(),
      key: '',
      type: 'fixed',
      value: '',
    };
    onChange([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<BodyField>) => {
    onChange(
      fields.map((field) =>
        field.id === id ? { ...field, ...updates } : field
      )
    );
  };

  const removeField = (id: string) => {
    onChange(fields.filter((field) => field.id !== id));
  };

  // Gerar preview do JSON
  const generateJsonPreview = () => {
    const obj: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.key) {
        obj[field.key] = field.value || '';
      }
    });
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="space-y-4">
      <Label>Campos do Body</Label>
      
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nenhum campo adicionado. Clique em "Adicionar campo" para começar.
        </p>
      )}
      
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="p-3 border border-border rounded-md space-y-3 bg-muted/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Campo {index + 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeField(field.id)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Nome do campo</Label>
            <Input
              value={field.key}
              onChange={(e) => updateField(field.id, { key: e.target.value })}
              placeholder="Ex: nome, telefone, email..."
              className="h-8 text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Tipo do valor</Label>
            <RadioGroup
              value={field.type}
              onValueChange={(v) => updateField(field.id, { type: v as 'fixed' | 'variable', value: '' })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id={`${field.id}-fixed`} />
                <Label htmlFor={`${field.id}-fixed`} className="text-xs font-normal cursor-pointer">
                  Fixo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="variable" id={`${field.id}-variable`} />
                <Label htmlFor={`${field.id}-variable`} className="text-xs font-normal cursor-pointer">
                  Variável
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Valor</Label>
            {field.type === 'fixed' ? (
              <Input
                value={field.value}
                onChange={(e) => updateField(field.id, { value: e.target.value })}
                placeholder="Digite o valor..."
                className="h-8 text-sm"
              />
            ) : (
              <Select
                value={field.value}
                onValueChange={(v) => updateField(field.id, { value: v })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione a variável" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_VARIABLES.map((variable) => (
                    <SelectItem key={variable.value} value={variable.value}>
                      {variable.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      ))}
      
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addField}
      >
        <Plus size={14} className="mr-1" />
        Adicionar campo
      </Button>
      
      {fields.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="text-xs text-muted-foreground">Preview do JSON</Label>
          <pre className="p-2 bg-muted rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {generateJsonPreview()}
          </pre>
        </div>
      )}
    </div>
  );
}

// Função para converter body_fields para objeto body
export function bodyFieldsToObject(fields: BodyField[]): Record<string, string> {
  const obj: Record<string, string> = {};
  fields.forEach((field) => {
    if (field.key) {
      obj[field.key] = field.value || '';
    }
  });
  return obj;
}

// Função para converter body existente para body_fields (retrocompatibilidade)
export function objectToBodyFields(body: Record<string, unknown>): BodyField[] {
  return Object.entries(body).map(([key, value]) => {
    const strValue = String(value || '');
    const isVariable = strValue.startsWith('{{') && strValue.endsWith('}}');
    return {
      id: crypto.randomUUID(),
      key,
      type: isVariable ? 'variable' : 'fixed',
      value: strValue,
    };
  });
}
