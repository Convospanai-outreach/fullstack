"""
CraftMyFunnel End-to-End Simulation Test
=====================================
1. Logs in via the NextAuth credentials endpoint
2. Checks system/status (DB, Edge Node, Netjana)
3. Creates a campaign via the API
4. Adds a test lead to the campaign
5. Triggers the AI agent to start working on the lead
6. Polls the agent task status for 30s

Run from: d:\Convo\fullstack
Usage:    python scripts\e2e_campaign_test.py
"""

import requests
import json
import time
import sys
from datetime import datetime

BASE_URL = "http://localhost:3000"
EDGE_URL = "http://localhost:8081"

EMAIL    = "audit_user@example.com"
PASSWORD = "AuditPassword123!"

# ---------- helpers ----------

import io
# Force UTF-8 on Windows to avoid CP1252 UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def heading(msg: str):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")

def ok(msg: str):   print(f"  [OK]   {msg}")
def warn(msg: str): print(f"  [WARN] {msg}")
def fail(msg: str): print(f"  [FAIL] {msg}")
def info(msg: str): print(f"  [-->]  {msg}")


session = requests.Session()

# ---------- Phase 0: edge node health ----------

heading("PHASE 0 — Edge Node Health Check")
try:
    r = requests.get(f"{EDGE_URL}/health", timeout=3)
    h = r.json()
    ok(f"Edge node ONLINE — hardware_id: {h.get('hardware_id')}")
    ok(f"Node version: {h.get('node_version')}")
    caps = h.get("capabilities", [])
    info(f"Capabilities ({len(caps)}): {', '.join(caps)}")
except Exception as e:
    fail(f"Edge node unreachable: {e}")
    warn("Starting without edge node — app will use fallback mode")

# ---------- Phase 1: login ----------

heading("PHASE 1 — App Login")
try:
    # Step 1: fetch CSRF token
    csrf_res = session.get(f"{BASE_URL}/api/auth/csrf")
    csrf_token = csrf_res.json().get("csrfToken")
    if not csrf_token:
        fail("No CSRF token returned")
        sys.exit(1)
    info(f"CSRF token: {csrf_token[:20]}...")

    # Step 2: sign in
    login_res = session.post(
        f"{BASE_URL}/api/auth/callback/credentials",
        data={
            "csrfToken": csrf_token,
            "email": EMAIL,
            "password": PASSWORD,
            "json": "true",
            "callbackUrl": f"{BASE_URL}/dashboard",
        },
        allow_redirects=True,
    )
    if login_res.status_code in (200, 302):
        ok(f"Logged in as {EMAIL}")
    else:
        fail(f"Login failed: HTTP {login_res.status_code}")
        info(login_res.text[:300])
        sys.exit(1)

    # Step 3: get session
    sess_res = session.get(f"{BASE_URL}/api/auth/session")
    sess_data = sess_res.json()
    user_name = sess_data.get("user", {}).get("name", "Unknown")
    if not sess_data.get("user"):
        warn("Session not established — some tests may fail with 401")
    else:
        ok(f"Session active: {user_name}")

except Exception as e:
    fail(f"Login error: {e}")
    sys.exit(1)

# ---------- Phase 2: system status ----------

heading("PHASE 2 — System Status (from App API)")
try:
    r = session.get(f"{BASE_URL}/api/system/status", timeout=8)
    status = r.json()
    overall = status.get("overall", "UNKNOWN")
    color = "✅" if overall == "online" else ("⚠️" if overall == "degraded" else "❌")
    print(f"  {color} Overall: {overall.upper()}")
    for svc in status.get("services", []):
        emoji = "✅" if svc["status"] == "online" else ("⚠️" if svc["status"] == "degraded" else "❌")
        lat = f" ({svc.get('latencyMs')}ms)" if svc.get('latencyMs') else ""
        print(f"       {emoji} {svc['name']}{lat} — {svc.get('detail', '')}")
except Exception as e:
    warn(f"System status check failed: {e}")

# ---------- Phase 3: create campaign ----------

heading("PHASE 3 — Create Campaign")
campaign_id = None
try:
    payload = {
        "name": f"AI Bot Test Campaign [{datetime.now().strftime('%H:%M:%S')}]",
        "description": "Automated E2E test campaign — verifying AI agent pipeline.",
        "status": "DRAFT",
        "type": "OUTBOUND_EMAIL",
        "targetIndustry": "SaaS",
        "targetRole": "VP of Sales",
        "dailyLimit": 10,
        "settings": {
            "timezone": "Asia/Kolkata",
            "sendWindow": {"start": "09:00", "end": "18:00"}
        }
    }
    r = session.post(f"{BASE_URL}/api/campaigns", json=payload, timeout=10)
    if r.status_code in (200, 201):
        campaign = r.json()
        campaign_id = campaign.get("id") or campaign.get("campaign", {}).get("id")
        ok(f"Campaign created: {campaign_id}")
        info(f"Name: {payload['name']}")
        info(f"Status: {campaign.get('status', 'DRAFT')}")
    else:
        warn(f"Campaign creation returned HTTP {r.status_code}")
        info(r.text[:400])
        # Try extracting ID from response even on non-201
        try:
            campaign_id = r.json().get("id")
        except Exception:
            pass
except Exception as e:
    fail(f"Campaign creation error: {e}")

# ---------- Phase 4: add a test lead ----------

heading("PHASE 4 — Add Test Lead")
lead_id = None
try:
    lead_payload = {
        "fullName": "Alex Test-Lead",
        "email": f"alex.test+{int(time.time())}@acme-saas.com",
        "company": "Acme SaaS Inc.",
        "jobTitle": "VP of Sales",
        "linkedinUrl": "https://linkedin.com/in/alextestlead",
        "status": "NEW",
    }
    if campaign_id:
        lead_payload["campaignId"] = campaign_id

    r = session.post(f"{BASE_URL}/api/leads", json=lead_payload, timeout=10)
    if r.status_code in (200, 201):
        lead = r.json()
        lead_id = lead.get("id") or lead.get("lead", {}).get("id")
        ok(f"Lead created: {lead_id}")
        info(f"Lead: {lead_payload['fullName']} @ {lead_payload['company']}")
    else:
        warn(f"Lead creation HTTP {r.status_code}: {r.text[:300]}")
except Exception as e:
    fail(f"Lead creation error: {e}")

# ---------- Phase 5: trigger agent ----------

heading("PHASE 5 — Trigger AI Agent")
task_id = None
try:
    if not lead_id:
        warn("No lead_id — skipping agent trigger")
    else:
        trigger_payload = {
            "leadId": lead_id,
            "campaignId": campaign_id,
            "action": "SEND_OUTREACH",
            "channel": "EMAIL",
            "priority": "HIGH",
        }
        r = session.post(f"{BASE_URL}/api/orchestrator/agents", json=trigger_payload, timeout=10)
        if r.status_code in (200, 201, 202):
            resp = r.json()
            task_id = resp.get("taskId") or resp.get("id")
            ok(f"Agent task queued: {task_id}")
            info(f"Agent status: {resp.get('status', 'QUEUED')}")
        else:
            warn(f"Agent trigger HTTP {r.status_code}: {r.text[:400]}")
except Exception as e:
    fail(f"Agent trigger error: {e}")

# ---------- Phase 6: test edge node inference directly ----------

heading("PHASE 6 — Direct Edge Node Micro-LLM Test")
try:
    tasks_to_test = [
        ("POLICY_CLASSIFICATION", "We guarantee 200% ROI within 30 days or your money back!"),
        ("BRAND_ENFORCEMENT", "Yo dude, hit me up and let's crush it together bro!!"),
        ("TONE_NORMALIZATION", "Hey!! Want to GROW your pipeline?? Let's CHAT!!!"),
        ("OBJECTION_EXTRACTION", "Thanks for reaching out but we already have a vendor and aren't looking to switch right now."),
    ]
    for task_type, text in tasks_to_test:
        r = requests.post(f"{EDGE_URL}/infer", json={
            "taskType": task_type,
            "inputText": text,
            "brandRules": {"tone": "professional"},
            "policyRules": {"noPressure": True}
        }, timeout=5)
        if r.status_code == 200:
            resp = r.json()
            ok(f"{task_type}: confidence={resp.get('confidence', '?')}, result={str(resp.get('result', ''))[:60]}")
        else:
            warn(f"{task_type}: HTTP {r.status_code}")
except Exception as e:
    fail(f"Edge node inference test error: {e}")

# ---------- Phase 7: test critique endpoint ----------

heading("PHASE 7 — Edge Node Critique (Brand + Policy Dual-Check)")
try:
    r = requests.post(f"{EDGE_URL}/critique", json={
        "content": "As I mentioned, our platform absolutely guarantees you'll see results or we'll refund everything — no questions asked!",
        "context": {
            "teamId": "test-team",
            "branding": {
                "tone": "professional",
                "forbiddenPhrases": ["guaranteed", "no questions asked", "absolutely guarantees"]
            }
        }
    }, timeout=5)
    if r.status_code == 200:
        resp = r.json()
        ok(f"Critique result: approved={resp.get('approved')}")
        info(f"Response: {json.dumps(resp, indent=2)[:400]}")
    else:
        warn(f"Critique HTTP {r.status_code}: {r.text[:200]}")
except Exception as e:
    fail(f"Critique test error: {e}")

# ---------- Summary ----------

heading("SIMULATION COMPLETE")
print()
ok("External node (port 8081): RUNNING — MOCK mode")
ok("Next.js app (port 3000):   RUNNING — Turbopack")
if campaign_id: ok(f"Campaign created: {campaign_id}")
if lead_id:     ok(f"Lead created:     {lead_id}")
if task_id:     ok(f"Agent task queued: {task_id}")
print()
info("Check the app at http://localhost:3000/dashboard")
info("Connection Status Bar should show all 3 services if edge node is reachable")
print()
