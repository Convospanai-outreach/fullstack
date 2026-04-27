export interface ExperimentVariant {
    id: string;
    experimentId: string;
    name: string;
    config: any;
    sampleCount: number;
    successCount: number;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface Experiment {
    id: string;
    teamId: string;
    name: string;
    goal: string;
    status: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    variants?: ExperimentVariant[];
}

export interface TrainingDataset {
    id: string;
    teamId: string;
    taskType: string;
    promptText: string;
    idealResponse: string;
    status: 'PENDING' | 'IN_REVIEW' | 'REVIEWED' | 'REJECTED' | string;
    reviewedBy?: string | null;
    version: number;
    createdAt: Date | string;
    updatedAt: Date | string;
}
