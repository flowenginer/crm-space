import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { ArrowLeft, Save, Play, Loader2 } from 'lucide-react';
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

function FlowEditorInner() {
  const { id: flowId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  const { data: flow } = useChatbotFlow(flowId || null);
  const { data: savedNodes, isSuccess: nodesLoaded } = useFlowNodes(flowId || null);
  const { data: savedConnections, isSuccess: connectionsLoaded } = useFlowConnections(flowId || null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<FlowNodeData | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  // Carregar nós e conexões salvos
  useEffect(() => {
    if (nodesLoaded && connectionsLoaded && !loaded) {
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
      }
      
      if (savedConnections && savedConnections.length > 0) {
        const loadedEdges = savedConnections.map(c => ({
          id: c.id,
          source: c.source_node_id,
          target: c.target_node_id,
          sourceHandle: c.source_handle,
          animated: true,
        }));
        setEdges(loadedEdges);
      }
      
      setLoaded(true);
    }
  }, [nodesLoaded, connectionsLoaded, savedNodes, savedConnections, loaded, setNodes, setEdges]);
  
  // Conectar nós
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges]
  );
  
  // Dropar nó do palette
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
      
      const newNodeId = `node_${Date.now()}`;
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
  
  // Salvar fluxo
  const handleSave = async () => {
    if (!flowId) return;
    
    setSaving(true);
    try {
      // Deletar nós e conexões existentes
      await supabase.from('flow_connections').delete().eq('flow_id', flowId);
      await supabase.from('flow_nodes').delete().eq('flow_id', flowId);
      
      // Mapear IDs temporários para UUIDs
      const nodeIdMap: Record<string, string> = {};
      
      // Inserir nós
      for (const node of nodes) {
        const nodeData = node.data as FlowNodeData;
        const { data: newNode, error } = await supabase
          .from('flow_nodes')
          .insert({
            flow_id: flowId,
            name: nodeData.name,
            node_type: nodeData.nodeType,
            node_subtype: nodeData.nodeSubtype,
            position_x: node.position.x,
            position_y: node.position.y,
            config: nodeData.config,
          })
          .select()
          .single();
        
        if (error) throw error;
        nodeIdMap[node.id] = newNode.id;
      }
      
      // Inserir conexões
      for (const edge of edges) {
        const sourceId = nodeIdMap[edge.source];
        const targetId = nodeIdMap[edge.target];
        
        if (sourceId && targetId) {
          await supabase.from('flow_connections').insert({
            flow_id: flowId,
            source_node_id: sourceId,
            target_node_id: targetId,
            source_handle: edge.sourceHandle || 'default',
          });
        }
      }
      
      // Atualizar timestamp do fluxo
      await supabase
        .from('chatbot_flows')
        .update({ updated_at: new Date().toISOString(), is_draft: false })
        .eq('id', flowId);
      
      toast.success('Fluxo salvo com sucesso!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao salvar: ' + message);
    } finally {
      setSaving(false);
    }
  };
  
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
            disabled={saving}
            className="bg-gradient-to-r from-primary to-pink-600"
          >
            {saving ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Save size={16} className="mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 flex">
        {/* Palette */}
        <NodePalette />
        
        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
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
        <span>Arraste blocos da esquerda para o canvas</span>
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
