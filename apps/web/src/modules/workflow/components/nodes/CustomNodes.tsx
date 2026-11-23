import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Bot, Clock, Split, Mail, Linkedin } from 'lucide-react';

export const AiNode = memo(({ data }: any) => {
    return (
        <div className="px-4 py-2 shadow-md rounded-md bg-primary/20 border-2 border-primary/30 text-foreground min-w-[150px]">
            <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-primary" />
                <div className="font-bold text-xs uppercase tracking-wider">AI Step</div>
            </div>
            <div className="text-xs text-primary">{data.label}</div>
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-primary/20" />
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-primary/20" />
        </div>
    );
});

export const DelayNode = memo(({ data }: any) => {
    return (
        <div className="px-4 py-2 shadow-md rounded-md bg-background border-2 border-border text-foreground min-w-[150px]">
            <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-foreground/80" />
                <div className="font-bold text-xs uppercase tracking-wider">Delay</div>
            </div>
            <div className="text-xs text-foreground">{data.delay || "1 day"} duration</div>
            <Handle type="target" position={Position.Top} className="!bg-muted" />
            <Handle type="source" position={Position.Bottom} className="!bg-muted" />
        </div>
    );
});

export const ConditionNode = memo(({ data }: any) => {
    return (
        <div className="px-4 py-2 shadow-md rounded-full bg-warning/20 border-2 border-warning/30 text-foreground min-w-[150px] text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
                <Split className="w-4 h-4 text-warning" />
                <div className="font-bold text-xs uppercase tracking-wider">Condition</div>
            </div>
            <div className="text-xs text-warning">{data.label}</div>

            <Handle type="target" position={Position.Top} className="!bg-warning/20" />

            {/* Split outputs */}
            <div className="flex justify-between mt-2 px-4 text-[10px] font-bold">
                <span className="text-success">TRUE</span>
                <span className="text-destructive">FALSE</span>
            </div>

            <Handle type="source" position={Position.Bottom} id="true" className="!bg-success left-[30%]" />
            <Handle type="source" position={Position.Bottom} id="false" className="!bg-destructive left-[70%]" />
        </div>
    );
});

export const ActionNode = memo(({ data }: any) => {
    const isEmail = data.actionType === 'EMAIL';
    return (
        <div className={`px-4 py-2 shadow-md rounded-md border-2 text-foreground min-w-[150px] ${isEmail ? "bg-primary/20 border-primary/30" : "bg-primary/20 border-primary/30"
            }`}>
            <div className="flex items-center gap-2 mb-1">
                {isEmail ? <Mail className="w-4 h-4 text-primary" /> : <Linkedin className="w-4 h-4 text-primary" />}
                <div className="font-bold text-xs uppercase tracking-wider">{data.actionType || 'Action'}</div>
            </div>
            <div className="text-xs opacity-80">{data.label}</div>
            <Handle type="target" position={Position.Top} className="!bg-card" />
            <Handle type="source" position={Position.Bottom} className="!bg-card" />
        </div>
    );
});
