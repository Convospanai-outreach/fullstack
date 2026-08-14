"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, { Background, Controls, Node, Edge, NodeTypes, Handle, Position, NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { X } from "lucide-react";
import SenderScheduleNode, { SenderScheduleNodeData, SequenceMailbox } from "./SenderScheduleNode";
import AddStepButton from "./AddStepButton";
import { findStepDefinition } from "./stepDefinitions";

export interface SequenceStepItem {
    id: string;
    stepType: string;
}

interface SequenceStepNodeData {
    stepType: string;
    onRemove: () => void;
}

function SequenceStepNode({ data }: NodeProps<SequenceStepNodeData>) {
    const def = findStepDefinition(data.stepType);
    const Icon = def?.icon;
    return (
        <div className="relative w-80 rounded-lg border border-border bg-card p-4 shadow-sm">
            <Handle type="target" position={Position.Top} className="!bg-blue-500" />
            <div className="flex items-center gap-2.5">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-blue-500" />}
                <span className="flex-1 text-sm font-medium">{def?.label || data.stepType}</span>
                <button
                    type="button"
                    onClick={data.onRemove}
                    className="text-muted-foreground transition hover:text-foreground"
                    aria-label="Remove step"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
        </div>
    );
}

interface AddStepNodeData {
    linkedinLocked: boolean;
    onSelect: (stepType: string) => void;
}

function AddStepFlowNode({ data }: NodeProps<AddStepNodeData>) {
    return (
        <div className="relative flex justify-center">
            <Handle type="target" position={Position.Top} className="!bg-blue-500" />
            <AddStepButton linkedinLocked={data.linkedinLocked} onSelect={data.onSelect} />
        </div>
    );
}

const nodeTypes: NodeTypes = {
    senderSchedule: SenderScheduleNode,
    sequenceStep: SequenceStepNode,
    addStep: AddStepFlowNode,
};

const NODE_GAP = 120;

export default function SequenceCanvas({
    steps,
    onStepsChange,
    senderMailboxIds,
    mailboxes,
    timezone,
    onSenderScheduleChange,
    linkedinLocked,
}: {
    steps: SequenceStepItem[];
    onStepsChange: (steps: SequenceStepItem[]) => void;
    senderMailboxIds: string[];
    mailboxes: SequenceMailbox[];
    timezone: string;
    onSenderScheduleChange: (update: { senderMailboxIds?: string[]; timezone?: string }) => void;
    linkedinLocked: boolean;
}) {
    const removeStep = useCallback(
        (stepId: string) => {
            onStepsChange(steps.filter((s) => s.id !== stepId));
        },
        [steps, onStepsChange]
    );

    const addStep = useCallback(
        (stepType: string) => {
            const id = `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            onStepsChange([...steps, { id, stepType }]);
        },
        [steps, onStepsChange]
    );

    const nodes: Node[] = useMemo(() => {
        const startNode: Node<SenderScheduleNodeData> = {
            id: "start",
            type: "senderSchedule",
            position: { x: 0, y: 0 },
            data: { senderMailboxIds, mailboxes, timezone, onChange: onSenderScheduleChange },
            draggable: false,
            selectable: false,
        };

        const stepNodes: Node<SequenceStepNodeData>[] = steps.map((step, index) => ({
            id: step.id,
            type: "sequenceStep",
            position: { x: 0, y: (index + 1) * NODE_GAP },
            data: { stepType: step.stepType, onRemove: () => removeStep(step.id) },
            draggable: false,
            selectable: false,
        }));

        const addNode: Node<AddStepNodeData> = {
            id: "add-step",
            type: "addStep",
            position: { x: 0, y: (steps.length + 1) * NODE_GAP },
            data: { linkedinLocked, onSelect: addStep },
            draggable: false,
            selectable: false,
        };

        return [startNode, ...stepNodes, addNode];
    }, [steps, senderMailboxIds, mailboxes, timezone, onSenderScheduleChange, removeStep, linkedinLocked, addStep]);

    const edges: Edge[] = useMemo(() => {
        const chain = ["start", ...steps.map((s) => s.id), "add-step"];
        return chain.slice(1).map((id, index) => ({
            id: `e-${chain[index]}-${id}`,
            source: chain[index]!,
            target: id,
            type: "straight",
        }));
    }, [steps]);

    return (
        <div className="h-full w-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnScroll
                fitView
                fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
            >
                <Background gap={16} size={1} />
                <Controls showInteractive={false} />
            </ReactFlow>
        </div>
    );
}
