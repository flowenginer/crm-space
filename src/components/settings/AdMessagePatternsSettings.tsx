import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, MessageSquare, Instagram, Facebook, Globe, Link2, Megaphone, History, Loader2 } from 'lucide-react';
import { useAdMessagePatterns, useCreateAdMessagePattern, useUpdateAdMessagePattern, useDeleteAdMessagePattern, AdMessagePattern, CreateAdMessagePattern } from '@/hooks/useAdMessagePatterns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SOURCE_OPTIONS = [
  { value: 'meta_ads', label: 'Meta Ads', icon: Megaphone, color: 'bg-blue-500' },
  { value: 'google_ads', label: 'Google Ads', icon: Globe, color: 'bg-green-500' },
  { value: 'linktree', label: 'Linktree', icon: Link2, color: 'bg-purple-500' },
  { value: 'site', label: 'Site', icon: Globe, color: 'bg-orange-500' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-pink-500' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
  { value: 'other', label: 'Outro', icon: MessageSquare, color: 'bg-gray-500' },
] as const;

const MATCH_TYPE_OPTIONS = [
  { value: 'exact', label: 'Exato', description: 'Mensagem deve ser exatamente igual' },
  { value: 'contains', label: 'Contém', description: 'Mensagem deve conter o texto' },
  { value: 'starts_with', label: 'Começa com', description: 'Mensagem deve começar com o texto' },
  { value: 'ends_with', label: 'Termina com', description: 'Mensagem deve terminar com o texto' },
] as const;

type SourceType = typeof SOURCE_OPTIONS[number]['value'];
type MatchType = typeof MATCH_TYPE_OPTIONS[number]['value'];

interface PatternFormData {
  pattern: string;
  match_type: MatchType;
  source: SourceType;
  campaign_name: string;
  description: string;
  priority: number;
  is_active: boolean;
}

const defaultFormData: PatternFormData = {
  pattern: '',
  match_type: 'exact',
  source: 'meta_ads',
  campaign_name: '',
  description: '',
  priority: 50,
  is_active: true,
};

export function AdMessagePatternsSettings() {
  const { data: patterns, isLoading } = useAdMessagePatterns();
  const createPattern = useCreateAdMessagePattern();
  const updatePattern = useUpdateAdMessagePattern();
  const deletePattern = useDeleteAdMessagePattern();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<AdMessagePattern | null>(null);
  const [formData, setFormData] = useState<PatternFormData>(defaultFormData);
  const [isFixingHistorical, setIsFixingHistorical] = useState(false);

  const handleFixHistorical = async () => {
    setIsFixingHistorical(true);
    try {
      const { data, error } = await supabase.rpc('fix_historical_origin_detection');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const result = data[0];
        const count = result.updated_count || 0;
        if (count > 0) {
          toast.success(`${count} conversas foram corrigidas!`, {
            description: `Breakdown: ${JSON.stringify(result.source_breakdown || {})}`
          });
        } else {
          toast.info('Nenhuma conversa precisava de correção');
        }
      } else {
        toast.info('Nenhuma conversa precisava de correção');
      }
    } catch (error) {
      console.error('Error fixing historical:', error);
      toast.error('Erro ao corrigir dados históricos');
    } finally {
      setIsFixingHistorical(false);
    }
  };

  const handleOpenDialog = (pattern?: AdMessagePattern) => {
    if (pattern) {
      setEditingPattern(pattern);
      setFormData({
        pattern: pattern.pattern,
        match_type: pattern.match_type,
        source: pattern.source,
        campaign_name: pattern.campaign_name || '',
        description: pattern.description || '',
        priority: pattern.priority,
        is_active: pattern.is_active,
      });
    } else {
      setEditingPattern(null);
      setFormData(defaultFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPattern(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = async () => {
    const payload: CreateAdMessagePattern = {
      pattern: formData.pattern,
      match_type: formData.match_type,
      source: formData.source,
      campaign_name: formData.campaign_name || null,
      description: formData.description || null,
      priority: formData.priority,
      is_active: formData.is_active,
    };

    if (editingPattern) {
      await updatePattern.mutateAsync({ id: editingPattern.id, ...payload });
    } else {
      await createPattern.mutateAsync(payload);
    }
    handleCloseDialog();
  };

  const handleDelete = async (id: string) => {
    await deletePattern.mutateAsync(id);
  };

  const handleToggleActive = async (pattern: AdMessagePattern) => {
    await updatePattern.mutateAsync({ id: pattern.id, is_active: !pattern.is_active });
  };

  const getSourceInfo = (source: string) => {
    return SOURCE_OPTIONS.find(s => s.value === source) || SOURCE_OPTIONS[6];
  };

  const getMatchTypeLabel = (matchType: string) => {
    return MATCH_TYPE_OPTIONS.find(m => m.value === matchType)?.label || matchType;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Padrões de Mensagens de Origem
            </CardTitle>
            <CardDescription>
              Configure mensagens padrão para identificar automaticamente a origem dos leads (Meta Ads, Linktree, Site, etc.)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleFixHistorical}
              disabled={isFixingHistorical}
            >
              {isFixingHistorical ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <History className="h-4 w-4 mr-2" />
              )}
              Corrigir Histórico
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Padrão
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingPattern ? 'Editar Padrão' : 'Novo Padrão de Mensagem'}
                </DialogTitle>
                <DialogDescription>
                  Configure uma mensagem padrão que identifica a origem do lead automaticamente.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="pattern">Mensagem Padrão *</Label>
                  <Textarea
                    id="pattern"
                    placeholder="Ex: Olá! Tenho interesse e queria mais informações, por favor."
                    value={formData.pattern}
                    onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="source">Origem *</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value: SourceType) => setFormData({ ...formData, source: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="match_type">Tipo de Correspondência *</Label>
                    <Select
                      value={formData.match_type}
                      onValueChange={(value: MatchType) => setFormData({ ...formData, match_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATCH_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div>
                              <div>{option.label}</div>
                              <div className="text-xs text-muted-foreground">{option.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="campaign_name">Nome da Campanha (opcional)</Label>
                    <Input
                      id="campaign_name"
                      placeholder="Ex: Black Friday 2024"
                      value={formData.campaign_name}
                      onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Input
                      id="priority"
                      type="number"
                      min={0}
                      max={100}
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-muted-foreground">Maior = maior prioridade</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Mensagem padrão da campanha de Black Friday"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Padrão ativo</Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!formData.pattern || createPattern.isPending || updatePattern.isPending}
                >
                  {editingPattern ? 'Salvar Alterações' : 'Criar Padrão'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : patterns && patterns.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="max-w-[300px]">Padrão de Mensagem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((pattern) => {
                const sourceInfo = getSourceInfo(pattern.source);
                const SourceIcon = sourceInfo.icon;
                return (
                  <TableRow key={pattern.id}>
                    <TableCell>
                      <Switch
                        checked={pattern.is_active}
                        onCheckedChange={() => handleToggleActive(pattern)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${sourceInfo.color} text-white`}>
                        <SourceIcon className="h-3 w-3 mr-1" />
                        {sourceInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="truncate font-mono text-sm" title={pattern.pattern}>
                        {pattern.pattern}
                      </div>
                      {pattern.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {pattern.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getMatchTypeLabel(pattern.match_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{pattern.priority}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(pattern)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir padrão?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O padrão será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(pattern.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum padrão de mensagem configurado.</p>
            <p className="text-sm">Adicione padrões para identificar automaticamente a origem dos leads.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
