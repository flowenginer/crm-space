import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Play, Loader2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  useChatbotFlow, useFlowNodes, useFlowConnections 
} from '@/hooks/useChatbotFlows';
import { NodePalette } from '@/components/flow-builder/NodePalette';
import { PropertiesPanel } from '@/components/flow-builder/PropertiesPanel';
import { BaseNode } from '@/components/flow-builder/nodes/BaseNode';
import { FlowNodeData } from '@/types/flow';

const nodeTypes = {
  trigger: BaseNode,
  action: BaseNode,
  condition: BaseNode,
  delay: BaseNode,
  end: BaseNode,
};

// Verifica se o ID é um UUID válido (vem do banco)
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Gera UUID para novos nós (ao invés de node_xxx)
function generateNodeId(): string {
  return crypto.randomUUID();
}

function FlowEditorInner() {
  const { id: flowId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  const { data: flow } = useChatbotFlow(flowId || null);
  const { data: savedNodes, isSuccess: nodesLoaded, dataUpdatedAt: nodesUpdatedAt } = useFlowNodes(flowId || null);
  const { data: savedConnections, isSuccess: connectionsLoaded, dataUpdatedAt: connectionsUpdatedAt } = useFlowConnections(flowId || null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<FlowNodeData | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number>(0);
  const [isDataReady, setIsDataReady] = useState(false);
  
  // Determina se o fluxo está vazio (carregado mas sem nós)
  const isFlowEmpty = nodesLoaded && connectionsLoaded && savedNodes?.length === 0;
  
  // Carregar nós e conexões salvos
  useEffect(() => {
    const shouldReload = nodesLoaded && connectionsLoaded && 
      (nodesUpdatedAt > lastLoadedAt || connectionsUpdatedAt > lastLoadedAt);
    
    if (shouldReload) {
      if (savedNodes && savedNodes.length > 0) {
        const loadedNodes = savedNodes.map(n => ({
          id: n.id,
          type: n.node_type,
          position: { x: n.position_x, y: n.position_y },
          data: {
            id: n.id,
            flowId: n.flow_id,
            name: n.name || '',
            nodeType: n.node_type as FlowNodeData['nodeType'],
            nodeSubtype: n.node_subtype,
            config: n.config as Record<string, unknown>,
          },
        }));
        setNodes(loadedNodes);
        
        // Carregar edges após os nós estarem renderizados
        if (savedConnections && savedConnections.length > 0) {
          setTimeout(() => {
            const loadedEdges = savedConnections.map(c => ({
              id: c.id,
              source: c.source_node_id,
              target: c.target_node_id,
              // Se source_handle é 'default', deixar undefined para match com Handle sem id
              sourceHandle: c.source_handle === 'default' ? undefined : c.source_handle,
              animated: true,
              type: 'default',
              style: { strokeDasharray: '5,5', stroke: 'hsl(var(--muted-foreground))' },
            }));
            setEdges(loadedEdges);
            setIsDataReady(true);
          }, 50);
        } else {
          setEdges([]);
          setIsDataReady(true);
        }
      } else {
        setNodes([]);
        setEdges([]);
        setIsDataReady(true);
      }
      
      setLastLoadedAt(Math.max(nodesUpdatedAt, connectionsUpdatedAt));
    }
  }, [nodesLoaded, connectionsLoaded, savedNodes, savedConnections, nodesUpdatedAt, connectionsUpdatedAt, lastLoadedAt, setNodes, setEdges]);

  // Marcar como pronto quando os dados estão carregados
  useEffect(() => {
    if (nodesLoaded && connectionsLoaded && lastLoadedAt > 0) {
      setIsDataReady(true);
    }
  }, [nodesLoaded, connectionsLoaded, lastLoadedAt]);
  
  // Conectar nós
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ 
        ...connection, 
        animated: true,
        type: 'default',
        style: { strokeDasharray: '5,5', stroke: 'hsl(var(--muted-foreground))' },
      }, eds));
    },
    [setEdges]
  );
  
  // Dropar nó do palette - AGORA USA UUID
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;
      
      const nodeData = JSON.parse(data);
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      
      if (!reactFlowBounds) return;
      
      const position = {
        x: event.clientX - reactFlowBounds.left - 90,
        y: event.clientY - reactFlowBounds.top - 25,
      };
      
      // USAR UUID ao invés de node_xxx para estabilidade
      const newNodeId = generateNodeId();
      const newNode = {
        id: newNodeId,
        type: nodeData.nodeType,
        position,
        data: {
          id: newNodeId,
          flowId: flowId || '',
          name: nodeData.name,
          nodeType: nodeData.nodeType,
          nodeSubtype: nodeData.nodeSubtype,
          config: nodeData.config || {},
          icon: nodeData.icon,
          color: nodeData.color,
        },
      };
      
      setNodes((nds) => [...nds, newNode]);
    },
    [flowId, setNodes]
  );
  
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  // Selecionar nó
  const onNodeClick = useCallback((_: React.MouseEvent, node: { data: FlowNodeData }) => {
    setSelectedNode(node.data);
  }, []);
  
  // Atualizar config do nó
  const updateNodeConfig = useCallback((nodeId: string, config: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                config, 
                name: (config._name as string) || n.data.name 
              } 
            }
          : n
      )
    );
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, config } : prev);
  }, [setNodes]);

  // Manter selectedNode sincronizado com nodes
  useEffect(() => {
    if (selectedNode) {
      const currentNode = nodes.find(n => n.id === selectedNode.id);
      if (currentNode && JSON.stringify(currentNode.data.config) !== JSON.stringify(selectedNode.config)) {
        setSelectedNode(currentNode.data);
      }
    }
  }, [nodes, selectedNode]);
  
  // Criar fluxo inicial para fluxos vazios
  const createInitialFlow = async () => {
    if (!flowId) return;
    
    setSaving(true);
    try {
      const triggerId = generateNodeId();
      const actionId = generateNodeId();
      const endId = generateNodeId();
      
      // Criar 3 nós básicos
      const nodesData = [
        {
          id: triggerId,
          flow_id: flowId,
          name: 'Início',
          node_type: 'trigger',
          node_subtype: 'message_received',
          position_x: 250,
          position_y: 50,
          config: {},
        },
        {
          id: actionId,
          flow_id: flowId,
          name: 'Enviar Mensagem',
          node_type: 'action',
          node_subtype: 'send_message',
          position_x: 250,
          position_y: 200,
          config: { message: 'Olá! Como posso ajudar?' },
        },
        {
          id: endId,
          flow_id: flowId,
          name: 'Fim',
          node_type: 'end',
          node_subtype: 'end_flow',
          position_x: 250,
          position_y: 350,
          config: {},
        },
      ];
      
      const { error: nodesError } = await supabase
        .from('flow_nodes')
        .insert(nodesData as any);
      
      if (nodesError) throw nodesError;
      
      // Criar 2 conexões
      const connectionsData = [
        {
          flow_id: flowId,
          source_node_id: triggerId,
          target_node_id: actionId,
          source_handle: 'default',
        },
        {
          flow_id: flowId,
          source_node_id: actionId,
          target_node_id: endId,
          source_handle: 'default',
        },
      ];
      
      const { error: connError } = await supabase
        .from('flow_connections')
        .insert(connectionsData);
      
      if (connError) throw connError;
      
      // Invalidar cache para recarregar
      await queryClient.invalidateQueries({ queryKey: ['flow-nodes', flowId] });
      await queryClient.invalidateQueries({ queryKey: ['flow-connections', flowId] });
      
      toast.success('Fluxo inicial criado!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao criar fluxo: ' + message);
    } finally {
      setSaving(false);
    }
  };
  
  // Salvar fluxo - COM PROTEÇÕES
  const handleSave = async () => {
    if (!flowId) return;
    
    // PROTEÇÃO 1: Não salvar se os dados ainda não carregaram
    if (!isDataReady) {
      toast.warning('Aguarde o carregamento completo antes de salvar.');
      return;
    }
    
    // PROTEÇÃO 2: Se nodes está vazio e o banco tinha dados, bloquear
    if (nodes.length === 0) {
      const { data: existingCheck } = await supabase
        .from('flow_nodes')
        .select('id')
        .eq('flow_id', flowId)
        .limit(1);
      
      if (existingCheck && existingCheck.length > 0) {
        toast.error('Canvas vazio detectado. Recarregue a página e tente novamente.');
        return;
      }
    }
    
    setSaving(true);
    try {
      // Buscar IDs dos nós atualmente salvos no banco
      const { data: existingNodesData } = await supabase
        .from('flow_nodes')
        .select('id')
        .eq('flow_id', flowId);
      
      const existingIds = new Set(existingNodesData?.map(n => n.id) || []);
      const currentIds = new Set(nodes.map(n => n.id));
      
      // Identificar nós para DELETE (estavam no banco mas não estão mais)
      const toDelete = [...existingIds].filter(id => !currentIds.has(id));
      
      // Identificar nós para UPDATE (já existiam no banco)
      const toUpdate = nodes.filter(n => existingIds.has(n.id));
      
      // Identificar nós para INSERT (novos - não estão no banco)
      const toInsert = nodes.filter(n => !existingIds.has(n.id));
      
      // PROTEÇÃO 3: Se vamos apagar tudo sem inserir/atualizar nada, abortar
      if (toDelete.length > 0 && toUpdate.length === 0 && toInsert.length === 0) {
        toast.error('Operação bloqueada: isso apagaria todos os nós sem substituição.');
        setSaving(false);
        return;
      }
      
      // === REORDENADO: PRIMEIRO INSERIR/ATUALIZAR, DEPOIS DELETAR ===
      
      // 1. Atualizar nós existentes PRIMEIRO
      for (const node of toUpdate) {
        const nodeData = node.data as FlowNodeData;
        const { error } = await supabase
          .from('flow_nodes')
          .update({
            name: nodeData.name,
            node_type: nodeData.nodeType,
            node_subtype: nodeData.nodeSubtype,
            position_x: node.position.x,
            position_y: node.position.y,
            config: nodeData.config as any,
          })
          .eq('id', node.id);
        
        if (error) throw error;
      }
      
      // 2. Inserir nós novos (já têm UUID, usar o mesmo ID)
      for (const node of toInsert) {
        const nodeData = node.data as FlowNodeData;
        const insertData: Record<string, unknown> = {
          id: node.id, // USAR O MESMO UUID
          flow_id: flowId,
          name: nodeData.name,
          node_type: nodeData.nodeType,
          node_subtype: nodeData.nodeSubtype,
          position_x: node.position.x,
          position_y: node.position.y,
          config: nodeData.config,
        };
        const { error } = await supabase
          .from('flow_nodes')
          .insert(insertData as any);
        
        if (error) throw error;
      }
      
      // 3. Deletar conexões antigas
      await supabase.from('flow_connections').delete().eq('flow_id', flowId);
      
      // 4. Inserir conexões em lote (IDs já são estáveis) - com deduplicação
      if (edges.length > 0) {
        // Deduplicar conexões antes de salvar
        const uniqueConnections = edges
          .filter(edge => edge.source && edge.target)
          .reduce((acc, edge) => {
            const key = `${edge.source}-${edge.target}-${edge.sourceHandle || 'default'}`;
            if (!acc.has(key)) {
              acc.set(key, {
                flow_id: flowId,
                source_node_id: edge.source,
                target_node_id: edge.target,
                source_handle: edge.sourceHandle || 'default',
              });
            }
            return acc;
          }, new Map<string, { flow_id: string; source_node_id: string; target_node_id: string; source_handle: string }>());

        const connectionsToInsert = [...uniqueConnections.values()];
        
        if (connectionsToInsert.length > 0) {
          const { error: connError } = await supabase
            .from('flow_connections')
            .insert(connectionsToInsert);
          
          if (connError) throw connError;
        }
      }
      
      // 5. Deletar nós removidos APENAS NO FINAL
      if (toDelete.length > 0) {
        await supabase.from('flow_nodes').delete().in('id', toDelete);
      }
      
      // 6. Atualizar timestamp do fluxo
      await supabase
        .from('chatbot_flows')
        .update({ updated_at: new Date().toISOString(), is_draft: false })
        .eq('id', flowId);
      
      // 7. Invalidar cache para recarregar dados atualizados
      await queryClient.invalidateQueries({ queryKey: ['flow-nodes', flowId] });
      await queryClient.invalidateQueries({ queryKey: ['flow-connections', flowId] });
      
      toast.success('Fluxo salvo com sucesso!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao salvar: ' + message);
    } finally {
      setSaving(false);
    }
  };
  
  // Loading state
  const isLoading = !nodesLoaded || !connectionsLoaded;
  
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/automations')}
          >
            <ArrowLeft size={18} className="mr-2" />
            Voltar
          </Button>
          <h1 className="text-foreground font-semibold">{flow?.name || 'Carregando...'}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Play size={16} className="mr-2" />
            Testar
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={saving || isLoading || !isDataReady}
            className="bg-gradient-to-r from-primary to-pink-600"
          >
            {saving ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : isLoading ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Save size={16} className="mr-2" />
            )}
            {isLoading ? 'Carregando...' : 'Salvar'}
          </Button>
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Palette */}
        <NodePalette />
        
        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          {/* Empty state overlay */}
          {isFlowEmpty && isDataReady && nodes.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="text-center p-8 bg-card rounded-lg border border-border shadow-lg max-w-md">
                <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Fluxo vazio
                </h3>
                <p className="text-muted-foreground mb-6">
                  Este fluxo não possui nenhum bloco. Você pode criar um fluxo inicial básico ou arrastar blocos da paleta à esquerda.
                </p>
                <Button 
                  onClick={createInitialFlow}
                  disabled={saving}
                  className="bg-gradient-to-r from-primary to-pink-600"
                >
                  {saving ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Plus size={16} className="mr-2" />
                  )}
                  Criar fluxo inicial
                </Button>
              </div>
            </div>
          )}
          
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
          >
            <Background color="hsl(var(--muted-foreground) / 0.2)" gap={20} />
            <Controls className="!bg-card !border-border [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
            <MiniMap 
              className="!bg-card !border-border" 
              nodeColor="hsl(var(--primary))"
              maskColor="hsl(var(--background) / 0.8)"
            />
          </ReactFlow>
        </div>
        
        {/* Properties */}
        <PropertiesPanel
          node={selectedNode}
          onUpdate={updateNodeConfig}
          onClose={() => setSelectedNode(null)}
        />
      </div>
      
      {/* Footer */}
      <div className="h-8 bg-card border-t border-border flex items-center justify-between px-4 text-xs text-muted-foreground">
        <span>Nós: {nodes.length} | Conexões: {edges.length}</span>
        <span>{isDataReady ? 'Arraste blocos da esquerda para o canvas' : 'Carregando dados...'}</span>
      </div>
    </div>
  );
}

export default function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
