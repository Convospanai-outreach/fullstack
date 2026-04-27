import { mcpManager } from "@/lib/mcp/McpManager";

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OutreachTask {
    id: string;
    type: 'EMAIL' | 'SLACK';
    target: string;
    content: string;
    status: ApprovalStatus;
}

export class OutreachAgent {
    // In-memory queue for demo purposes. In production, use Redis.
    private static taskQueue: Map<string, OutreachTask> = new Map();

    /**
     * Drafts a message and places it in the approval queue.
     */
    static async draftMessage(type: 'EMAIL' | 'SLACK', target: string, content: string): Promise<OutreachTask> {
        const id = crypto.randomUUID();
        const task: OutreachTask = {
            id,
            type,
            target,
            content,
            status: 'PENDING'
        };

        this.taskQueue.set(id, task);
        console.log(`[OutreachAgent] Drafted ${type} task ${id} for approval.`);
        return task;
    }

    /**
     * Executes the task ONLY if it is APPROVED.
     */
    static async executeTask(taskId: string): Promise<boolean> {
        const task = this.taskQueue.get(taskId);
        if (!task) throw new Error("Task not found");

        if (task.status !== 'APPROVED') {
            console.warn(`[OutreachAgent] Cannot execute task ${taskId} (Status: ${task.status})`);
            return false;
        }

        try {
            if (task.type === 'SLACK') {
                await mcpManager.callTool('post_message', { channel_id: task.target, text: task.content });
            } else {
                await mcpManager.callTool('send_email', { to: task.target, subject: "Outreach", body: task.content });
            }
            this.taskQueue.delete(taskId);
            return true;
        } catch (error) {
            console.error(`[OutreachAgent] Execution failed:`, error);
            return false;
        }
    }

    static getPendingTasks(): OutreachTask[] {
        return Array.from(this.taskQueue.values()).filter(t => t.status === 'PENDING');
    }

    static approveTask(taskId: string) {
        const task = this.taskQueue.get(taskId);
        if (task) task.status = 'APPROVED';
    }

    static rejectTask(taskId: string) {
        const task = this.taskQueue.get(taskId);
        if (task) task.status = 'REJECTED';
    }
}
