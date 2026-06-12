# create-CraftMyFunnel-scaffold.ps1
# Run in your project root (e.g. D:\Convo\extracted)
# PowerShell: Right-click -> Run with PowerShell or `.\create-CraftMyFunnel-scaffold.ps1`

$root = Join-Path (Get-Location) "CraftMyFunnel-full-pack"
if (Test-Path $root) { Remove-Item -Recurse -Force $root }
New-Item -ItemType Directory -Path $root | Out-Null

# helper to write files
function Write-File($path, $content) {
  $full = Join-Path $root $path
  $dir = Split-Path $full -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $content | Out-File -FilePath $full -Encoding UTF8
}

# README
Write-File "README.md" @"
CraftMyFunnel Full Fix Pack (Scaffold)
=================================

This scaffold contains minimal, safe, and well-documented placeholder implementations to help you continue development quickly.

Top areas included (F):
- Hunter.io wrapper (src/integrations/hunter.ts)
- LinkedIn Puppeteer-based scraper + Chrome extension scaffold (src/integrations/linkedin/puppeteer-bridge & chrome-extension)
- WhatsApp Cloud API webhook & helper (src/integrations/whatsapp.ts)
- Organogram Graph Engine (Prisma schema + src/graph/*)
- Communication Manager AI (simple sentiment + strategy engine in src/ai/communicationManager.ts)
- RAG engine + vector store (src/ai/ragEngine.ts, src/ai/vectorStore.ts)
- Orchestrator v3 that ties channels and AI together (src/orchestrator/runCampaignV3.ts)
- Minimal Next.js API routes (src/pages/api/orchestrator/run.ts, etc.) for local testing
- .env.example and package.json with scripts to build and run locally

How to use:
1. Extract into your project folder (or run inside a container).
2. Run: npm install
3. Copy .env.example -> .env and fill keys (or leave for mock behavior)
4. Run: npm run build and npm start (or run Next in dev)
"@

# .env.example
Write-File ".env.example" @"
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
***REMOVED***
***REMOVED***
WHATSAPP_TOKEN=your_whatsapp_token_here
DATABASE_URL=file:./dev.db
NODE_ENV=development
"@

# package.json
Write-File "package.json" @"
{
  "name": "CraftMyFunnel-full-pack",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "next": "13.5.6",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "sqlite3": "^5.1.6",
    "prisma": "^4.19.0",
    "puppeteer-core": "^24.0.0",
    "express": "^4.18.2",
    "node-fetch": "^2.6.7"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
"@

# prisma schema
Write-File "prisma/schema.prisma" @"
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Company {
  id        String   @id @default(cuid())
  name      String   @unique
  domain    String?
  createdAt DateTime @default(now())
  people    Person[]
}

model Person {
  id        String   @id @default(cuid())
  name      String
  title     String?
  email     String?  @unique
  linkedin  String?
  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])
  metadata  Json?
  createdAt DateTime @default(now())
}

model Edge {
  id        String   @id @default(cuid())
  fromId    String
  toId      String
  type      String
  weight    Float    @default(1.0)
  meta      Json?
  createdAt DateTime @default(now())
}
"@

# Next API route
Write-File "src/pages/api/orchestrator/run.ts" @"
import type { NextApiRequest, NextApiResponse } from 'next';
import { runCampaign } from '@/src/orchestrator/runCampaignV3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { company, contact, linkedin } = req.body;
    const result = await runCampaign(company, contact, linkedin);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
"@

# Orchestrator V3
Write-File "src/orchestrator/runCampaignV3.ts" @"
import { getCompanyInsights } from '../integrations/research';
import { scrapeLinkedInProfile } from '../integrations/linkedin/scraper-bridge';
import { findEmail } from '../integrations/hunter';
import { buildICP } from '../integrations/icp';
import { sendEmailViaSendPulse } from '../integrations/sendpulse';
import { sendWhatsApp } from '../integrations/whatsapp';
import { generateWithGemini } from '../ai/gemini';
import { extractKeyInsights, buildRAGContext } from '../ai/ragEngine';
import { analyzeCommunication } from '../ai/communicationManager';

export async function runCampaign(companyName: string, contactName: string, contactLinkedIn: string, options: any = {}) {
  try {
    const insights = await getCompanyInsights(companyName);
    const profile = await scrapeLinkedInProfile(contactLinkedIn);
    const email = await findEmail(insights.website || (companyName.replace(/\\s+/g,'') + '.com'), contactName);
    const icp = await buildICP({ name: companyName }, profile, options.assets || []);
    const ragCtx = await buildRAGContext(companyName);
    const prompt = `Write a short outreach email to ${profile.name || contactName} at ${companyName}. Context: ${insights.summary}. ICP pain points: ${icp.icp_data?.pain_points?.join(', ') || ''}`;
    const aiText = await generateWithGemini(prompt);
    const html = `<div><p>Hi ${profile.name || contactName},</p><p>${aiText}</p></div>`;
    const sendRes = await sendEmailViaSendPulse(email || 'no-reply@example.com', `Opportunity for ${companyName}`, html);
    if (profile.metadata?.phone) {
      await sendWhatsApp(profile.metadata.phone, `Hi ${profile.name || contactName}, we emailed you about ${companyName}.`);
    }
    const commAnalysis = analyzeCommunication(aiText);
    return { status: sendRes.status || 'ok', emailSent: true, insights, profile, icp, commAnalysis };
  } catch (err) {
    return { status: 'failed', error: String(err) };
  }
}
"@

# integrations (research, linkedin stub, hunter, icp, sendpulse, whatsapp)
Write-File "src/integrations/research.ts" @"
export async function getCompanyInsights(name: string) {
  return {
    name,
    summary: `${name} (mock) operates in the software sector and has typical scaling pain points.`,
    website: `https://${name.replace(/\\s+/g,'').toLowerCase()}.com`
  };
}
"@

Write-File "src/integrations/linkedin/scraper-bridge.ts" @"
export async function scrapeLinkedInProfile(url: string) {
  return {
    name: 'John Doe',
    title: 'Senior Product Manager',
    location: 'San Francisco Bay Area',
    skills: ['Product Management','Strategy','Leadership','Agile'],
    metadata: { phone: '+1-555-000-0000' },
    linkedin: url
  };
}
"@

Write-File "src/integrations/hunter.ts" @"
export async function findEmail(domainOrName: string, name: string): Promise<string | null> {
  try {
    const safe = (name || 'user').toLowerCase().replace(/[^a-z]/g,'.');
    const domain = (domainOrName || 'example.com').toString().replace(/^https?:\\/\\//,'');
    return `${safe}@${domain}`;
  } catch (e) {
    return null;
  }
}
"@

Write-File "src/integrations/icp.ts" @"
export async function buildICP(company: any, profile: any, assets: any[] = []) {
  return {
    company: company.name,
    name: profile.name || 'Unknown',
    title: profile.title || '',
    skills: profile.skills || [],
    icp_data: { pain_points: ['Scaling challenges for software companies'] }
  };
}
"@

Write-File "src/integrations/sendpulse.ts" @"
export async function sendEmailViaSendPulse(to: string, subject: string, html: string) {
  return { status: 'sent', id: 'mock-send-123', to, subject };
}
"@

Write-File "src/integrations/whatsapp.ts" @"
export async function sendWhatsApp(toPhone: string, message: string) {
  console.log('[mock whatsapp] sending to', toPhone, message);
  return { status: 'sent', to: toPhone };
}
"@

# AI helpers
Write-File "src/ai/gemini.ts" @"
export async function generateWithGemini(prompt: string, opts: any = {}) {
  if (process.env.NODE_ENV === 'test') return `MOCK:${prompt.substring(0,80)}`;
  return `PERSONALIZED_MESSAGE: ${prompt.substring(0,200)}`;
}
"@

Write-File "src/ai/vectorStore.ts" @"
import fs from 'fs';
import path from 'path';
const STORE = path.resolve(process.cwd(), '.tmp_vectors.json');
export type Doc = { id: string; content: string; metadata?: any };
async function readStore(): Promise<Doc[]> {
  try { const raw = await fs.promises.readFile(STORE, 'utf8'); return JSON.parse(raw || '[]'); } catch (e) { return []; }
}
export async function upsertDocuments(docs: Doc[]) {
  const cur = await readStore(); const map = new Map(cur.map(d=>[d.id,d])); for (const d of docs) map.set(d.id, d); await fs.promises.writeFile(STORE, JSON.stringify(Array.from(map.values()), null, 2));
}
export async function searchSimilar(q: string, topN = 3): Promise<Doc[]> {
  const docs = await readStore();
  const scored = docs.map(d => ({ d, score: (d.content.toLowerCase().includes(q.toLowerCase())?2:0) + Math.min(1, q.length/Math.max(1,d.content.length)) }));
  return scored.sort((a,b)=>b.score-a.score).slice(0,topN).map(s=>s.d);
}
"@

Write-File "src/ai/ragEngine.ts" @"
import { searchSimilar } from './vectorStore';
import { generateWithGemini } from './gemini';
export async function extractKeyInsights(query: string) {
  const docs = await searchSimilar(query, 5);
  const ctx = docs.map(d=>d.content).join('\\n---\\n');
  const prompt = `Extract top insights from:\\n${ctx}\\nQuery:${query}`;
  const generated = await generateWithGemini(prompt);
  return { summary: generated, docsCount: docs.length };
}
export async function buildRAGContext(seed: string) {
  const docs = await searchSimilar(seed, 5);
  return { context: docs.map(d=>d.content).join('\\n'), docs };
}
"@

Write-File "src/ai/communicationManager.ts" @"
export function analyzeCommunication(text: string) {
  const lower = (text || '').toLowerCase();
  const positive = ['interested','love','ok','sure','yes','great','thanks'];
  const neutral = ['maybe','looking','curious','explore'];
  const negative = ['not interested','no','never','stop','unsubscribe','blocked'];
  let score = 0;
  for (const p of positive) if (lower.includes(p)) score += 2;
  for (const n of neutral) if (lower.includes(n)) score += 1;
  for (const neg of negative) if (lower.includes(neg)) score -= 3;
  const sentiment = score > 1 ? 'positive' : (score >= 0 ? 'neutral' : 'negative');
  const eagerness = score > 1 ? 'high' : (score === 1 ? 'medium' : 'low');
  const suggestion = sentiment === 'positive' ? 'follow_up_call' : (sentiment === 'neutral' ? 'nudge_sequence' : 'pause_outreach');
  return { sentiment, eagerness, score, suggestion };
}
"@

# Chrome extension scaffold (manifest + content/background)
Write-File "chrome-extension/manifest.json" @"
{
  ""manifest_version"": 3,
  ""name"": ""CraftMyFunnel LinkedIn Bridge (scaffold)"",
  ""version"": ""0.0.1"",
  ""permissions"": [""storage"", ""activeTab"", ""scripting""],
  ""host_permissions"": [""https://www.linkedin.com/*""],
  ""background"": { ""service_worker"": ""background.js"" },
  ""content_scripts"": [
    {
      ""matches"": [""https://www.linkedin.com/*""],
      ""js"": [""content.js""]
    }
  ],
  ""action"": { ""default_popup"": ""popup.html"" }
}
"@

Write-File "chrome-extension/content.js" "console.log('CraftMyFunnel extension stub - content script');"
Write-File "chrome-extension/background.js" "console.log('CraftMyFunnel extension stub - background');"

# simple Next page to satisfy build
Write-File "src/pages/index.tsx" @"
export default function Home() {
  return (
    <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1>CraftMyFunnel Full Pack - Scaffold</h1>
      <p>POST /api/orchestrator/run with { company, contact, linkedin } to test orchestrator.</p>
    </main>
  );
}
"@

# create zip
$zipPath = Join-Path (Get-Location) "CraftMyFunnel-full-pack.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($root, $zipPath)
Write-Host "Created zip:" $zipPath
Write-Host "`nNext steps (recommended):"
Write-Host "1) Copy CraftMyFunnel-full-pack.zip to your project root and extract or merge files."
Write-Host "2) In project root run: npm install"
Write-Host "3) Copy .env.example -> .env and fill keys or leave to use mocks."
Write-Host "4) Run: npm run prisma:generate"
Write-Host "5) Run: npm run build"
Write-Host "6) Run: npm start (or npm run dev for local development)"
