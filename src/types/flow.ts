export type NodeType = 'trigger' | 'action' | 'condition' | 'delay' | 'end';

export interface FlowNodeData {
  id: string;
  flowId: string;
  name: string;
  nodeType: NodeType;
  nodeSubtype: string;
  config: Record<string, unknown>;
  icon?: string;
  color?: string;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  animated?: boolean;
}
