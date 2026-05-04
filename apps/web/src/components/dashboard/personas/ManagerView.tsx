"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Target, CheckCircle, AlertCircle } from "lucide-react";

export default function ManagerView() {
    const teamMembers = [
        { name: "Sarah Connor", role: "SDR Lead", performance: 92, status: "active", avatar: "SC" },
        { name: "John Reese", role: "Account Exec", performance: 88, status: "active", avatar: "JR" },
        { name: "Harold Finch", role: "Analyst", performance: 98, status: "active", avatar: "HF" },
        { name: "Root", role: "Ops Specialist", performance: 74, status: "warning", avatar: "RT" },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sample Conversion Rate</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">87%</div>
                        <p className="text-xs text-muted-foreground">Example lead-to-meeting movement</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sample Qualified Leads</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">42</div>
                        <p className="text-xs text-muted-foreground">Example qualification count</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sample Follow-ups Due</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1,240</div>
                        <p className="text-xs text-muted-foreground">Example follow-up workload</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sample Lead Performance</CardTitle>
                    <CardDescription>Example operating view for conversion and meeting-readiness review</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {teamMembers.map((member, i) => (
                            <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarFallback>{member.avatar}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-sm">{member.name}</p>
                                        <p className="text-xs text-muted-foreground">{member.role}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-sm font-bold">{member.performance}%</p>
                                        <p className="text-[10px] text-muted-foreground">Conversion</p>
                                    </div>
                                    {member.status === 'active' ? (
                                        <Badge variant="success">On Track</Badge>
                                    ) : (
                                        <Badge variant="warning">Needs Support</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        Sample Approvals Pending
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span>Root has 14 follow-ups due in "Ops Pipeline".</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Approval needed for "Q4 Outreach Campaign" launch.</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
