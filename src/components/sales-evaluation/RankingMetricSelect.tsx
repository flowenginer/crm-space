import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';

export type RankingMetric = 
  | 'avgScore'
  | 'closingRate'
  | 'avgConduction'
  | 'avgObjectionScore'
  | 'avgClareza'
  | 'avgCordialidade'
  | 'avgProatividade'
  | 'avgConhecimento'
  | 'avgTempoResposta'
  | 'avgPersonalizacao'
  | 'avgSensoUrgencia'
  | 'avgRecuperacao'
  | 'avgQualificacao'
  | 'avgFollowup'
  | 'evaluations';

interface RankingMetricSelectProps {
  value: RankingMetric;
  onChange: (metric: RankingMetric) => void;
}

const METRIC_OPTIONS: { value: RankingMetric; label: string }[] = [
  { value: 'avgScore', label: 'Score Geral' },
  { value: 'closingRate', label: 'Taxa de Fechamento' },
  { value: 'avgConduction', label: 'Condução' },
  { value: 'avgObjectionScore', label: 'Nota Objeções' },
  { value: 'avgClareza', label: 'Clareza' },
  { value: 'avgCordialidade', label: 'Cordialidade' },
  { value: 'avgProatividade', label: 'Proatividade' },
  { value: 'avgConhecimento', label: 'Conhecimento Produto' },
  { value: 'avgTempoResposta', label: 'Tempo de Resposta' },
  { value: 'avgPersonalizacao', label: 'Personalização' },
  { value: 'avgSensoUrgencia', label: 'Senso de Urgência' },
  { value: 'avgRecuperacao', label: 'Recuperação Final' },
  { value: 'avgQualificacao', label: 'Qualificação Lead' },
  { value: 'avgFollowup', label: 'Follow-up Estruturado' },
  { value: 'evaluations', label: 'Qtd. Avaliações' },
];

export function RankingMetricSelect({ value, onChange }: RankingMetricSelectProps) {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as RankingMetric)}>
      <SelectTrigger className="w-[200px]">
        <BarChart3 className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Métrica do ranking" />
      </SelectTrigger>
      <SelectContent>
        {METRIC_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getMetricLabel(metric: RankingMetric): string {
  return METRIC_OPTIONS.find(o => o.value === metric)?.label || metric;
}
