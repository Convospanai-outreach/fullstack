"use client";

// WorkflowSection.tsx
// Progressive disclosure workflow: progress rail + single active step detail card.
// Only the current incomplete step expands — all other steps are shown in the rail.

import Link from "next/link";
import { Check, CheckCircle } from "lucide-react";

interface WorkflowData {
  leadsImported: boolean;
  leadsCount: number;
  draftsGenerated: boolean;
  draftsCount: number;
  followUpsReviewed: boolean;
  followUpsCount: number;
  pendingSendCount: number;
}

function getCurrentStep(w: WorkflowData): 1 | 2 | 3 | 4 {
  if (!w.leadsImported) return 1;
  if (!w.draftsGenerated) return 2;
  if (!w.followUpsReviewed) return 3;
  return 4;
}

const STEPS = [
  { number: 1, title: 'Import leads', status: (w: WorkflowData) => w.leadsImported ? `${w.leadsCount} imported` : 'Not started' },
  { number: 2, title: 'Generate drafts', status: (w: WorkflowData) => w.draftsGenerated ? `${w.draftsCount} drafts` : 'Waiting' },
  { number: 3, title: 'Review follow-ups', status: (w: WorkflowData) => w.followUpsReviewed ? `${w.followUpsCount} reviewed` : 'Waiting' },
  { number: 4, title: 'Send drafts', status: (w: WorkflowData) => `${w.pendingSendCount} pending` },
];

function StepNode({ step, current, done }: { step: number; current: boolean; done: boolean }) {
  const baseSize = 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium relative z-10';

  if (done) return (
    <div className={`${baseSize} bg-success/15 border border-success text-success`}>
      <Check className="w-4 h-4" />
    </div>
  );
  if (current) return (
    <div className={`${baseSize} bg-primary/20 border border-primary text-primary`}>
      {step}
    </div>
  );
  return (
    <div className={`${baseSize} bg-muted border border-border text-muted-foreground`}>
      {step}
    </div>
  );
}

interface StepDetailCardProps {
  workflow: WorkflowData;
  currentStep: 1 | 2 | 3 | 4;
}

function StepDetailCard({ workflow, currentStep }: StepDetailCardProps) {
  const allComplete = currentStep === 4 &&
    workflow.leadsImported &&
    workflow.draftsGenerated &&
    workflow.followUpsReviewed &&
    workflow.pendingSendCount === 0;

  if (allComplete) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success/6 border border-success/18 rounded-xl">
        <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-success">Workflow complete</p>
          <p className="text-xs text-muted-foreground mt-0.5">All drafts sent for this cycle. Import new leads to start the next one.</p>
        </div>
      </div>
    );
  }

  const iconEmoji: Record<number, string> = { 1: '📥', 2: '✍️', 3: '👀', 4: '📤' };

  const steps: Record<number, {
    title: string;
    desc: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel?: string;
    secondaryHref?: string;
    badge?: string;
  }> = {
    1: {
      title: 'Import your lead list',
      desc: 'Upload a CSV or connect a source. CraftMyFunnel detects buyer signals automatically.',
      primaryLabel: 'Import leads →',
      primaryHref: '/leads/import',
    },
    2: {
      title: 'Generate outreach drafts',
      desc: 'AI writes personalised emails for each lead using your approved playbooks.',
      primaryLabel: 'Generate drafts →',
      primaryHref: '/campaigns/new',
    },
    3: {
      title: `Review ${workflow.followUpsCount} pending draft approvals`,
      desc: 'Check AI-suggested draft emails before they go out. Edit tone or approve directly.',
      primaryLabel: 'Review approvals →',
      primaryHref: '/approvals',
      secondaryLabel: 'Skip for now',
    },
    4: {
      title: `Send ${workflow.pendingSendCount} queued drafts`,
      desc: 'Review and send queued email drafts. Once approved, emails move to the outbound queue.',
      primaryLabel: 'Open approvals →',
      primaryHref: '/approvals',
      secondaryLabel: `View all ${workflow.draftsCount} drafts`,
      secondaryHref: '/approvals',
      badge: `~${Math.ceil(workflow.pendingSendCount * 1)} min`,
    },
  };

  const step = steps[currentStep];

  return (
    <div className="bg-primary/5 border border-primary/25 rounded-xl p-4 flex gap-3 items-start">
      <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-lg flex-shrink-0">
        {iconEmoji[currentStep]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{step.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
        <div className="flex items-center flex-wrap gap-2 mt-3">
          <Link
            href={step.primaryHref}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            {step.primaryLabel}
          </Link>
          {step.secondaryLabel && (
            step.secondaryHref ? (
              <Link
                href={step.secondaryHref}
                className="text-muted-foreground text-xs border border-border rounded-md px-3 py-1.5 hover:text-foreground transition-colors"
              >
                {step.secondaryLabel}
              </Link>
            ) : (
              <button className="text-muted-foreground text-xs border border-border rounded-md px-3 py-1.5 hover:text-foreground transition-colors">
                {step.secondaryLabel}
              </button>
            )
          )}
          {step.badge && (
            <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 ml-auto">
              {step.badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface WorkflowSectionProps {
  data: WorkflowData | null;
  loading?: boolean;
}

function WorkflowSkeleton() {
  return (
    <div className="mb-4 animate-pulse">
      <div className="flex justify-between items-center mb-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="h-2 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-28 bg-muted rounded-xl" />
    </div>
  );
}

export function WorkflowSection({ data, loading }: WorkflowSectionProps) {
  if (loading || !data) return <WorkflowSkeleton />;

  const currentStep = getCurrentStep(data);

  return (
    <div className="mb-4">
      {/* Progress rail */}
      <div className="relative flex justify-between items-start mb-5 px-1">
        {/* Connector line */}
        <div className="absolute top-4 left-6 right-6 h-px bg-border z-0" />
        {STEPS.map((step) => {
          const done = step.number < currentStep;
          const current = step.number === currentStep;
          const stepStatus = step.status(data);

          return (
            <div key={step.number} className="flex flex-col items-center gap-1.5 flex-1">
              <StepNode step={step.number} current={current} done={done} />
              <p className={`text-[11px] font-medium text-center ${done ? 'text-success' : current ? 'text-primary' : 'text-muted-foreground'}`}>
                {step.title}
              </p>
              <p className="text-[10px] text-muted-foreground text-center">{stepStatus}</p>
            </div>
          );
        })}
      </div>

      {/* Active step detail card */}
      <StepDetailCard workflow={data} currentStep={currentStep} />
    </div>
  );
}
