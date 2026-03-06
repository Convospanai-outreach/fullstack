import React, { useState, useEffect } from 'react';
import { 
  BarChart, Activity, ShieldCheck, Mail, Phone, 
  Settings, Users, PlayCircle, AlertTriangle
} from 'lucide-react';

// Mock Data
const MOCK_CAMPAIGN = {
  id: "cmp-q3-enterprise",
  name: "Q3 Enterprise Outreach (Healthcare)",
  status: "active",
  metrics: {
    leads_processed: 1240,
    pii_scrubbed: 412,
    playbooks_generated: 4,
    meetings_booked: 28,
    uplift_score: "+14.2%"
  }
};

const MOCK_PLAYBOOK_STEPS = [
  { id: "step_1", action: "linkedin_message", day: 1, text: "Wait for connection -> Send introductory note." },
  { id: "step_2", action: "wait", day: 3, text: "Wait 48 hours for reply." },
  { id: "step_3", action: "email", day: 4, text: "Send value proposition on cost reduction." },
  { id: "step_4", action: "call_script", day: 7, text: "Call lead. Emphasize compliance features." }
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);

  const triggerPlaybookGen = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 2000); // Simulate API latency
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
      
      {/* ===== SIDEBAR ===== */}
      <nav className="fixed w-64 h-full bg-neutral-900 border-r border-neutral-800 p-6 flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" size={24} /> 
            ConvoSpan OS
          </h1>
          <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-1 block">Edge-Cloud Hybrid</span>
        </div>

        <ul className="space-y-2 flex-1">
          <li>
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'overview' ? 'bg-indigo-500/10 text-indigo-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
              <Activity size={18} /> Campaigns
            </button>
          </li>
          <li>
            <button onClick={() => setActiveTab('playbooks')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'playbooks' ? 'bg-indigo-500/10 text-indigo-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
              <PlayCircle size={18} /> Playbooks
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all">
              <Users size={18} /> Audiences
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all">
              <BarChart size={18} /> ML Performance
            </button>
          </li>
        </ul>

        <div className="pt-6 border-t border-neutral-800">
           <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all">
              <Settings size={18} /> Admin Policies
            </button>
        </div>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="ml-64 p-10 max-w-6xl">
        
        {/* HEADER */}
        <header className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-semibold text-white tracking-tight">Campaign Operations</h2>
            <p className="text-neutral-400 mt-1">Manage sovereign AI outreach flows and monitor drift.</p>
          </div>
          <div className="flex items-center gap-3 bg-neutral-900 border border-emerald-900/50 px-4 py-2 rounded-full">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-sm font-medium text-emerald-400">Micro-LLM Edge Active</span>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* METRICS GRID */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Leads", val: MOCK_CAMPAIGN.metrics.leads_processed },
                { label: "PII Entities Secured", val: MOCK_CAMPAIGN.metrics.pii_scrubbed, color: "text-amber-400" },
                { label: "Meetings Booked", val: MOCK_CAMPAIGN.metrics.meetings_booked, color: "text-emerald-400" },
                { label: "ML Uplift", val: MOCK_CAMPAIGN.metrics.uplift_score, color: "text-indigo-400" },
              ].map((stat, i) => (
                <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors">
                  <p className="text-neutral-500 text-sm font-medium mb-1">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color || "text-white"}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            {/* ACTIVE CAMPAIGN PANEL */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
               <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-medium text-white">{MOCK_CAMPAIGN.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-400 uppercase tracking-wider">Healthcare Compliant</span>
                       <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Running</span>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors">
                    View Logs
                  </button>
               </div>

               <div className="p-6">
                 <h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-4">Current Champion Playbook</h4>
                 
                 <div className="space-y-3">
                   {MOCK_PLAYBOOK_STEPS.map((step, i) => (
                     <div key={step.id} className="flex items-start gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800/50">
                        <div className="mt-1">
                          {step.action === 'email' && <Mail className="text-blue-400" size={18} />}
                          {step.action === 'call_script' && <Phone className="text-emerald-400" size={18} />}
                          {step.action === 'linkedin_message' && <Users className="text-indigo-400" size={18} />}
                          {step.action === 'wait' && <Activity className="text-neutral-500" size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">Day {step.day}</span>
                            <span className="text-xs text-neutral-500 uppercase tracking-wider">{step.action.replace('_', ' ')}</span>
                          </div>
                          <p className="text-neutral-300 text-sm">{step.text}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'playbooks' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
            <h3 className="text-2xl font-semibold mb-6">Orchestrator Workshop</h3>
            
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
              <h4 className="text-lg font-medium text-white mb-2">Generate New Playbook</h4>
              <p className="text-neutral-400 text-sm mb-6">Trigger the Cloud Gemini agent to reason over recent ML objections and generate a challenger sequence.</p>
              
              <div className="space-y-4 mb-6">
                 <div>
                   <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Target Audience Context</label>
                   <textarea 
                     className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                     rows="3"
                     defaultValue="VP of IT at Mid-Market Healthcare organizations. Concerned about HIPAA compliance and implementation time."
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Campaign Goal</label>
                   <input 
                     type="text"
                     className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                     defaultValue="Book 15-minute discovery call with AE"
                   />
                 </div>
              </div>

              <button 
                onClick={triggerPlaybookGen}
                disabled={isGenerating}
                className={`w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
                  ${isGenerating ? 'bg-indigo-600/50 text-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'}`}
              >
                {isGenerating ? (
                  <><div className="w-4 h-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin"></div> Orchestrating...</>
                ) : (
                  <><PlayCircle size={18} /> Spawn Playbook Generator Agent</>
                )}
              </button>
            </div>

            {/* Validation Callout */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-4">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h5 className="text-amber-500 font-medium text-sm">Principle Validation Required</h5>
                <p className="text-amber-500/80 text-sm mt-1">Any new playbook generated will automatically be routed to the `PrincipleGuardianAgent` to verify healthcare compliance policies before deployment.</p>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
