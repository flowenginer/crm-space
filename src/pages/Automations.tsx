import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Workflow, MoreVertical, Play, Pause,
  Copy, Trash2, Edit, BarChart3, Zap, GitBranch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  useChatbotFlows, useCreateFlow, useDeleteFlow, 
  useDuplicateFlow, useToggleFlowActive 
} from '@/hooks/useChatbotFlows';

export default function Automations() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDescription, setNewFlowDescription] = useState('');
  
  const { data: flows, isLoading } = useChatbotFlows();
  const createFlow = useCreateFlow();
  const deleteFlow = useDeleteFlow();
  const duplicateFlow = useDuplicateFlow();
  const toggleActive = useToggleFlowActive();
  
  // Filtrar por busca
  const filteredFlows = flows?.filter(flow => 
    flow.name.toLowerCase().includes(search.toLowerCase()) ||
    flow.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];
  
  // Contadores
  const activeCount = flows?.filter(f => f.is_active).length || 0;
  const draftCount = flows?.filter(f => f.is_draft && !f.is_active).length || 0;
  
  const handleCreate = async () => {
    if (!newFlowName.trim()) return;
    
    const flow = await createFlow.mutateAsync({
      name: newFlowName,
      description: newFlowDescription,
    });
    
    setShowCreateModal(false);
    setNewFlowName('');
    setNewFlowDescription('');
    
    // Navegar para o editor
    navigate(`/automations/${flow.id}/edit`);
  };

  const getNodeCount = (flow: typeof flows extends (infer T)[] | undefined ? T : never) => {
    if (!flow.nodes || flow.nodes.length === 0) return 0;
    return flow.nodes[0]?.count || 0;
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Workflow className="text-primary" />
            Automações
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie fluxos de chatbot e automações para WhatsApp
          </p>
        </div>
        
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-primary to-pink-600 hover:from-primary/90 hover:to-pink-600/90"
        >
          <Plus size={18} className="mr-2" />
          Novo Fluxo
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-foreground">{flows?.length || 0}</div>
          <div className="text-muted-foreground text-sm">Total de fluxos</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-green-500/30">
          <div className="text-2xl font-bold text-green-500">{activeCount}</div>
          <div className="text-muted-foreground text-sm">Ativos</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-yellow-500/30">
          <div className="text-2xl font-bold text-yellow-500">{draftCount}</div>
          <div className="text-muted-foreground text-sm">Rascunhos</div>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar fluxos..."
          className="pl-10"
        />
      </div>
      
      {/* Lista de Fluxos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredFlows.length === 0 ? (
        <div className="text-center py-12">
          <Workflow size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Nenhum fluxo encontrado</h3>
          <p className="text-muted-foreground mt-1">Crie seu primeiro fluxo de automação</p>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="mt-4"
            variant="outline"
          >
            <Plus size={18} className="mr-2" />
            Criar Fluxo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFlows.map((flow) => (
            <div
              key={flow.id}
              className={`bg-card rounded-xl border p-4 transition-all hover:border-primary/50 ${
                flow.is_active ? 'border-green-500/30' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Ícone de status */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    flow.is_active ? 'bg-green-500/20' : 'bg-muted'
                  }`}>
                    {flow.is_active ? (
                      <Zap className="text-green-500" size={20} />
                    ) : (
                      <GitBranch className="text-muted-foreground" size={20} />
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{flow.name}</h3>
                      {flow.is_active ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30">
                          Ativo
                        </Badge>
                      ) : flow.is_draft ? (
                        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30">
                          Rascunho
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    
                    {flow.description && (
                      <p className="text-muted-foreground text-sm mt-1">{flow.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{getNodeCount(flow)} nós</span>
                      <span>•</span>
                      <span>{flow.total_executions || 0} execuções</span>
                      <span>•</span>
                      <span>Atualizado {new Date(flow.updated_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                
                {/* Ações */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/automations/${flow.id}/edit`)}
                  >
                    <Edit size={16} className="mr-1" />
                    Editar
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => toggleActive.mutate({ 
                          flowId: flow.id, 
                          isActive: !flow.is_active 
                        })}
                        className="cursor-pointer"
                      >
                        {flow.is_active ? (
                          <>
                            <Pause size={16} className="mr-2" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <Play size={16} className="mr-2" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        onClick={() => navigate(`/automations/${flow.id}/stats`)}
                        className="cursor-pointer"
                      >
                        <BarChart3 size={16} className="mr-2" />
                        Estatísticas
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        onClick={() => duplicateFlow.mutate(flow.id)}
                        className="cursor-pointer"
                      >
                        <Copy size={16} className="mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir este fluxo?')) {
                            deleteFlow.mutate(flow.id);
                          }
                        }}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal Criar Fluxo */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fluxo de Automação</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="flow-name">Nome do Fluxo *</Label>
              <Input
                id="flow-name"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                placeholder="Ex: Boas-vindas, Qualificação de Lead..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="flow-description">Descrição (opcional)</Label>
              <Textarea
                id="flow-description"
                value={newFlowDescription}
                onChange={(e) => setNewFlowDescription(e.target.value)}
                placeholder="Descreva o objetivo deste fluxo..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!newFlowName.trim() || createFlow.isPending}
              className="bg-gradient-to-r from-primary to-pink-600"
            >
              {createFlow.isPending ? 'Criando...' : 'Criar e Editar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
