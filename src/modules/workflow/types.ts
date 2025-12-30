export type WorkflowNodeType =
    | 'trigger'
    | 'start'
    | 'action'
    | 'condition'
    | 'delay'
    | 'wait';

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    data: {
        label?: string;
        actionType?: string;
        field?: string;
        operator?: 'eq' | 'contains' | 'neq' | 'exists';
        value?: any;
        duration?: number;
        requiresApproval?: boolean;
        subject?: string;
        body?: string;
        [key: string]: any;
    };
    position?: { x: number; y: number };
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}
