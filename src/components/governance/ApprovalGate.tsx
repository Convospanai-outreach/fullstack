"use client";

import { useState, useEffect } from "react";
import { OutreachAgent, OutreachTask } from "@/lib/ai/agents/OutreachAgent";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Slack, Mail } from "lucide-react";
import { toast } from "sonner";

export function ApprovalGate() {
    const [tasks, setTasks] = useState<OutreachTask[]>([]);
    const [loading, setLoading] = useState(false);

    const refreshTasks = () => {
        // In a real app, this would be a server action or API call
        // For this demo, we can't directly access the static OutreachAgent from client
        // So we'll simulate fetching tasks for the UI demo
        const demoTasks: OutreachTask[] = [
            { id: 'demo_1', type: 'EMAIL', target: 'lead@example.com', content: 'Hi there, following up on our chat...', status: 'PENDING' },
            { id: 'demo_2', type: 'SLACK', target: '#sales-leads', content: 'New lead qualified: Acme Corp', status: 'PENDING' }
        ];
        setTasks(demoTasks);
    };

    useEffect(() => {
        refreshTasks();
    }, []);

    const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
        setLoading(true);
        try {
            // Mock API delay
            await new Promise(r => setTimeout(r, 800));

            setTasks(prev => prev.filter(t => t.id !== id));
            toast.success(`Task ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`);

            // In real app: call API to OutreachAgent.approveTask(id)
        } catch (e) {
            toast.error("Failed to process action");
        } finally {
            setLoading(false);
        }
    };

    if (tasks.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground border border-dashed rounded-lg">
                No pending approvals
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                Pending Agent Actions ({tasks.length})
            </h3>

            <div className="grid gap-4">
                {tasks.map(task => (
                    <Card key={task.id} className="border-l-4 border-l-orange-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    {task.type === 'SLACK' ? <Slack className="w-4 h-4 text-purple-500" /> : <Mail className="w-4 h-4 text-blue-500" />}
                                    <span className="capitalize">{task.type.toLowerCase()} Draft</span>
                                </div>
                                <Badge variant="outline" className="text-xs">{(task.status)}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2">
                            <div className="text-xs text-muted-foreground mb-1">To: {task.target}</div>
                            <div className="p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap">
                                {task.content}
                            </div>
                        </CardContent>
                        <CardFooter className="justify-end gap-2 pt-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAction(task.id, 'REJECT')}
                                disabled={loading}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                                <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => handleAction(task.id, 'APPROVE')}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                Approve & Execute
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
