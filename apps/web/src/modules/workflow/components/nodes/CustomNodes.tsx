import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Bot, Clock, Split, Mail, Linkedin } from 'lucide-react';

export const AiNode = memo(({ data }: any) => {
    return (
        <div className="px-4 py-2 shadow-md rounded-md bg-purple-900 border-2 border-purple-500 text-white min-w-[150px]">
            <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-purple-300" />
                <div className="font-bold text-xs uppercase tracking-wider">AI Step</div>
            </div>
            <div className="text-xs text-purple-100">{data.label}</div>
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-purple-300" />
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-purple-300" />
        </div>
    );
});

export const DelayNode = memo(({ data }: any) => {
    return (
        <div className="px-4 py-2 shadow-md rounded-md bg-slate-900 border-2 border-slate-500 text-white min-w-[150px]">
            <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-slate-300" />
                <div className="font-bold text-xs uppercase tracking-wider">Delay</div>
            </div>
            <div className="text-xs text-slate-200">{data.delay || "1 day"} duration</div>
            <Handle type="target" position={Position.Top} className="!bg-slate-300" />
            <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
        </div>
    );
});

export const ConditionNode = memo(({ data }: any) => {
    return (
        <div className="px-4 py-2 shadow-md rounded-full bg-orange-900 border-2 border-orange-500 text-white min-w-[150px] text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
                <Split className="w-4 h-4 text-orange-300" />
                <div className="font-bold text-xs uppercase tracking-wider">Condition</div>
            </div>
            <div className="text-xs text-orange-100">{data.label}</div>

            <Handle type="target" position={Position.Top} className="!bg-orange-300" />

            {/* Split outputs */}
            <div className="flex justify-between mt-2 px-4 text-[10px] font-bold">
                <span className="text-green-400">TRUE</span>
                <span className="text-red-400">FALSE</span>
            </div>

            <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500 left-[30%]" />
            <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 left-[70%]" />
        </div>
    );
});

export const ActionNode = memo(({ data }: any) => {
    const isEmail = data.actionType === 'EMAIL';
    return (
        <div className={`px-4 py-2 shadow-md rounded-md border-2 text-white min-w-[150px] ${isEmail ? "bg-blue-900 border-blue-500" : "bg-sky-900 border-sky-500"
            }`}>
            <div className="flex items-center gap-2 mb-1">
                {isEmail ? <Mail className="w-4 h-4 text-blue-300" /> : <Linkedin className="w-4 h-4 text-sky-300" />}
                <div className="font-bold text-xs uppercase tracking-wider">{data.actionType || 'Action'}</div>
            </div>
            <div className="text-xs opacity-80">{data.label}</div>
            <Handle type="target" position={Position.Top} className="!bg-white" />
            <Handle type="source" position={Position.Bottom} className="!bg-white" />
        </div>
    );
});
