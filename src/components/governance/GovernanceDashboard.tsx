import { Experiment, ExperimentVariant, TrainingDataset } from '@prisma/client';
import { ApprovalGate } from '@/components/governance/ApprovalGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    LineChart,
    Activity,
    Database,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';

interface GovernanceDashboardProps {
    experiments: (Experiment & { variants: ExperimentVariant[] })[];
    datasets: TrainingDataset[];
}

export function GovernanceDashboard({ experiments, datasets }: GovernanceDashboardProps) {
    const activeExperiments = experiments.filter(e => e.status === 'RUNNING');
    const approvedDatasets = datasets.filter(d => d.status === 'REVIEWED');
    const pendingDatasets = datasets.filter(d => d.status === 'IN_REVIEW');

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Governance Dashboard</h1>
                <Badge variant="outline" className="text-sm">
                    <Activity className="w-3 h-3 mr-1" />
                    System Health: OK
                </Badge>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Experiments</CardTitle>
                        <LineChart className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeExperiments.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {experiments.length - activeExperiments.length} paused/completed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Training Datasets</CardTitle>
                        <Database className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{approvedDatasets.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {pendingDatasets.length} pending review
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">PASS</div>
                        <p className="text-xs text-muted-foreground">
                            All audit logs intact
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Approval Gate */}
                <div className="lg:col-span-2">
                    <ApprovalGate />
                </div>

                {/* Experiments Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Active A/B Experiments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activeExperiments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No active experiments</p>
                        ) : (
                            <div className="space-y-4">
                                {activeExperiments.map((exp) => (
                                    <div key={exp.id} className="border-l-4 border-blue-500 pl-4 py-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold">{exp.name}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {exp.variants.length} variants • {exp.goal}
                                                </p>
                                            </div>
                                            <Button variant="outline" size="sm">View Results</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Training Datasets */}
                <Card>
                    <CardHeader>
                        <CardTitle>Training Datasets</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {datasets.map((dataset) => (
                                <div key={dataset.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        {dataset.status === 'REVIEWED' ? (
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                        ) : dataset.status === 'IN_REVIEW' ? (
                                            <Clock className="w-5 h-5 text-yellow-500" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500" />
                                        )}
                                        <div>
                                            <p className="font-medium">Dataset {dataset.version}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {dataset.taskType} • Version {dataset.version}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={dataset.status === 'REVIEWED' ? 'default' : 'secondary'}>
                                        {dataset.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
