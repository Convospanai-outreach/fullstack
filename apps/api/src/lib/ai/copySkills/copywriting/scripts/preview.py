#!/usr/bin/env python3
"""preview.py: render structured page copy as a self-contained HTML preview with a skim test and limit badges.

  python3 scripts/preview.py COPY.json [--out preview.html]

COPY.json follows assets/page-content.schema.json (see assets/example-copy.json): meta, sections
(hero, proof_bar, problem, benefits, how_it_works, testimonials, pricing, faq, final_cta) and optional checks.
The HTML has a SKIM toggle (headlines and buttons only, to run the skim test), a mobile-width toggle, and
character-count badges: pass, cut (past what the reader sees) or fail (over a hard limit) for the SEO title,
meta description, share text, every button label, and each item under "checks".

Examples
  python3 scripts/preview.py assets/example-copy.json
  python3 scripts/preview.py draft.json --out /tmp/preview.html
  python3 scripts/preview.py draft.json --validate-only --json

Exit codes: 0 ok, 1 the copy file breaks the schema or a badge is over a hard limit, 2 usage error.
No network, no external assets in the HTML. Standard library only.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import copy_check  # noqa: E402  (sibling module: limits and weak-CTA detection)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALIASES = {"proof-bar": "proof_bar", "proof": "proof_bar", "features": "benefits", "feature": "benefits", "steps": "how_it_works",
           "how-it-works": "how_it_works", "howitworks": "how_it_works", "cta": "final_cta", "final-cta": "final_cta",
           "text": "problem", "testimonial": "testimonials", "plans": "pricing"}


class UsageError(Exception):
    pass


# --------------------------------------------------------------------------- schema subset validator

def deref(schema, root):
    while isinstance(schema, dict) and "$ref" in schema:
        node = root
        for part in schema["$ref"].lstrip("#/").split("/"):
            node = node[part]
        schema = node
    return schema


def type_ok(node, typ) -> bool:
    if typ == "string":
        return isinstance(node, str)
    if typ == "boolean":
        return isinstance(node, bool)
    if typ == "array":
        return isinstance(node, list)
    if typ == "object":
        return isinstance(node, dict)
    if typ in ("number", "integer"):
        return isinstance(node, (int, float)) and not isinstance(node, bool)
    return True


def validate(node, schema, path, root, errs, warns):
    schema = deref(schema, root)
    if "oneOf" in schema:
        if not isinstance(node, dict):
            errs.append("%s: must be an object" % path)
            return
        want, names = node.get("type"), []
        branch = None
        for b in schema["oneOf"]:
            b = deref(b, root)
            c = b.get("properties", {}).get("type", {}).get("const")
            names.append(c)
            if c == want:
                branch = b
        if branch is None:
            errs.append("%s: unknown section type %r. Use one of: %s" % (path, want, ", ".join(str(n) for n in names)))
            return
        validate(node, branch, path, root, errs, warns)
        return
    typ = schema.get("type")
    if typ and not type_ok(node, typ):
        errs.append("%s: must be %s" % (path, "an " + typ if typ in ("array", "object", "integer") else "a " + typ))
        return
    if "const" in schema and node != schema["const"]:
        errs.append("%s: must be %r" % (path, schema["const"]))
    if "enum" in schema and node not in schema["enum"]:
        errs.append("%s: must be one of %s" % (path, ", ".join(map(str, schema["enum"]))))
    if isinstance(node, str):
        if "minLength" in schema and len(node.strip()) < schema["minLength"]:
            errs.append("%s: must not be empty" % path)
        if "maxLength" in schema and len(node) > schema["maxLength"]:
            errs.append("%s: %d characters is over the sanity limit of %d (wrong field?)" % (path, len(node), schema["maxLength"]))
        if "pattern" in schema and not re.search(schema["pattern"], node):
            errs.append("%s: does not match the expected format (%s)" % (path, schema["pattern"]))
    elif isinstance(node, list):
        if "minItems" in schema and len(node) < schema["minItems"]:
            errs.append("%s: needs at least %d item%s" % (path, schema["minItems"], "" if schema["minItems"] == 1 else "s"))
        if "maxItems" in schema and len(node) > schema["maxItems"]:
            errs.append("%s: has %d items, the maximum is %d" % (path, len(node), schema["maxItems"]))
        if "items" in schema:
            for i, it in enumerate(node):
                validate(it, schema["items"], "%s[%d]" % (path, i), root, errs, warns)
    elif isinstance(node, dict):
        for req in schema.get("required", []):
            if req not in node:
                errs.append("%s: missing required field '%s'" % (path, req))
        props = schema.get("properties", {})
        for k, v in node.items():
            if k in props:
                validate(v, props[k], "%s.%s" % (path, k) if path else k, root, errs, warns)
            elif props and not k.startswith("_"):
                warns.append("%s: unknown field '%s' is ignored" % (path or "top level", k))


def normalise(doc: dict) -> dict:
    """Accept ship-it style section names and plain-string buttons."""
    def fix_cta(v):
        return {"label": v, "href": "#"} if isinstance(v, str) else v

    for s in doc.get("sections", []) if isinstance(doc.get("sections"), list) else []:
        if not isinstance(s, dict):
            continue
        t = str(s.get("type", "")).strip().lower()
        s["type"] = ALIASES.get(t, t.replace("-", "_"))
        for k in ("cta", "secondary_cta"):
            if k in s:
                s[k] = fix_cta(s[k])
        for p in s.get("plans", []) if isinstance(s.get("plans"), list) else []:
            if isinstance(p, dict) and "cta" in p:
                p["cta"] = fix_cta(p["cta"])
        if s["type"] == "problem" and isinstance(s.get("body"), str):
            s["body"] = [s["body"]]
    return doc


def load_schema() -> dict:
    with open(os.path.join(ROOT, "assets", "page-content.schema.json"), encoding="utf-8") as fh:
        return json.load(fh)


def load_doc(path: str) -> dict:
    if path == "-":
        raw = sys.stdin.buffer.read()
    else:
        if not os.path.isfile(path):
            raise UsageError("file not found: %s" % path)
        with open(path, "rb") as fh:
            raw = fh.read()
    try:
        doc = json.loads(raw.decode("utf-8-sig", errors="replace"))
    except ValueError as ex:
        raise UsageError("%s is not valid JSON (%s). Start from assets/example-copy.json" % (path, ex))
    if not isinstance(doc, dict):
        raise UsageError("the copy file must be a JSON object with a 'sections' list")
    return doc


# --------------------------------------------------------------------------- checks

def collect_checks(doc: dict):
    """(key, label, platform, field, text) for every string that has a platform limit."""
    out = []
    m = doc.get("meta") or {}
    for key, label, plat, fld in (("title", "SEO title", "seo", "title"), ("description", "Meta description", "seo", "meta-description"),
                                  ("og_title", "Share title (Open Graph)", "open-graph", "og-title"),
                                  ("og_description", "Share description (Open Graph)", "open-graph", "og-description")):
        if isinstance(m.get(key), str) and m[key].strip():
            out.append(("meta." + key, label, plat, fld, m[key]))
    for s in doc.get("sections", []):
        ctas = []
        for k in ("cta", "secondary_cta"):
            if isinstance(s.get(k), dict):
                ctas.append(s[k])
        for p in s.get("plans", []) if isinstance(s.get("plans"), list) else []:
            if isinstance(p, dict) and isinstance(p.get("cta"), dict):
                ctas.append(p["cta"])
        for c in ctas:
            if isinstance(c.get("label"), str) and c["label"].strip():
                out.append(("btn:" + c["label"], "Button: " + c["label"], "button", "cta", c["label"]))
    for i, c in enumerate(doc.get("checks", []) if isinstance(doc.get("checks"), list) else []):
        if isinstance(c, dict) and isinstance(c.get("text"), str):
            out.append(("check:%d" % i, c.get("label") or "%s %s" % (c.get("platform"), c.get("field")),
                        str(c.get("platform")), str(c.get("field")), c["text"]))
    return out


def run_checks(doc: dict):
    specs = copy_check.load_json("platform-specs.json")
    kill = copy_check.load_json("kill-list.json")
    results, seen = [], set()
    for key, label, plat, fld, text in collect_checks(doc):
        if key in seen and key.startswith("btn:"):
            continue
        seen.add(key)
        try:
            r = copy_check.fit_one(plat, fld, text, specs)
        except copy_check.UsageError as ex:
            raise UsageError("checks: %s" % ex)
        r["key"], r["label"], r["text"] = key, label, text
        r["badge"] = {"ok": "pass", "cut": "warn", "over": "fail"}[r["status"]]
        r["weak_default"] = bool(key.startswith("btn:") and copy_check.weak_cta_hits(text, kill["weak_ctas"]))
        results.append(r)
    return results


# --------------------------------------------------------------------------- html

CSS = """
:root{--bg:#fbfaf8;--fg:#1b1a17;--muted:#66625b;--line:#dcd8d0;--card:#fff;--accent:__ACCENT__;--pass:#1a7f4b;--warn:#a15c00;--fail:#b42318;--wash:#f1eee8}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--fg:#f0eee9;--muted:#a19c92;--line:#3a3833;--card:#1f1e1b;--pass:#5bd08e;--warn:#f0b35a;--fail:#ff8a7d;--wash:#26241f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;background:var(--card);border-bottom:1px solid var(--line)}
.bar strong{margin-right:auto}.bar button{font:inherit;padding:6px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);cursor:pointer}
.bar button[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}
.wrap{max-width:1000px;margin:0 auto;padding:16px}.notice{padding:10px 14px;border:1px dashed var(--warn);border-radius:8px;color:var(--warn);margin-bottom:12px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 12px;padding:8px 14px}.panel summary{cursor:pointer;font-weight:600}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}td,th{text-align:left;padding:6px 8px;border-top:1px solid var(--line);vertical-align:top}
.cut{background:color-mix(in srgb,var(--warn) 25%,transparent);text-decoration:line-through}.small{font-size:13px;color:var(--muted)}
.badge{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:99px;font:600 12px/1.6 ui-monospace,monospace;border:1px solid currentColor;vertical-align:middle;white-space:nowrap}
.badge.pass{color:var(--pass)}.badge.warn{color:var(--warn)}.badge.fail{color:var(--fail)}.nobadges .badge{display:none}
.serp{font-family:Arial,sans-serif}.serp .t{color:#1a0dab;font-size:20px;line-height:1.3}.serp .u{color:#006621;font-size:14px}.serp .d{color:var(--muted);font-size:14px}
@media (prefers-color-scheme:dark){.serp .t{color:#8ab4f8}.serp .u{color:#9bd2a6}}
.frame{container-type:inline-size;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;transition:max-width .2s}
.frame.mobile{max-width:390px;margin:0 auto;border:8px solid var(--line);border-radius:30px}
.page section{padding:36px 28px;border-top:1px solid var(--line)}.page section:first-child{border-top:0}
.frame.mobile .page section{padding:26px 18px}h1{font-size:clamp(28px,5cqw,44px);line-height:1.12;margin:.2em 0}h2{font-size:clamp(22px,3.4cqw,30px);line-height:1.2;margin:0 0 .6em}h3{font-size:18px;margin:0 0 .3em}
.eyebrow{color:var(--accent);font-weight:600;margin:0}.sub{font-size:18px;color:var(--muted);max-width:60ch}
.btn{display:inline-block;padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;border:2px solid var(--accent);margin:6px 10px 6px 0}
.btn.primary{background:var(--accent);color:#fff}.btn.secondary{color:var(--accent)}.triggers{list-style:none;padding:0;margin:6px 0 0;color:var(--muted);font-size:14px}.triggers li{display:inline-block;margin-right:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--bg)}
.proofline{color:var(--pass);font-size:14px;margin:.4em 0 0}.stat{font-size:26px;font-weight:700}.logos span{display:inline-block;margin:0 16px 0 0;color:var(--muted);font-weight:600}
blockquote{margin:0;padding:0 0 0 14px;border-left:3px solid var(--accent)}blockquote footer{color:var(--muted);font-size:14px}
.price{font-size:28px;font-weight:700}.tag{background:var(--accent);color:#fff;border-radius:6px;padding:1px 8px;font-size:12px}
details.q{border-top:1px solid var(--line);padding:8px 0}details.q summary{font-weight:600;cursor:pointer}
.skim .body-copy{display:none}.skim .page section{padding-top:18px;padding-bottom:18px}
"""

JS = """(function(){var f=document.getElementById('frame'),b=document.body;
function tog(id,cls,el){var n=document.getElementById(id);n.addEventListener('click',function(){var on=el().classList.toggle(cls);n.setAttribute('aria-pressed',on?'true':'false');});}
tog('skim','skim',function(){return f});tog('mobile','mobile',function(){return f});tog('badges','nobadges',function(){return b});})();"""


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


def safe_href(h) -> str:
    h = str(h or "#").strip()
    if re.match(r"^(https?://|mailto:|tel:|#|/|\./|\.\./)", h) or re.match(r"^[\w./-]+$", h):
        return h
    return "#"


def badge_html(r) -> str:
    if not r:
        return ""
    cap = r["limit"] if r["limit"] is not None else r["visible"]
    title = {"pass": "within the limit", "warn": "fits, but the reader's view cuts it off", "fail": "over the hard limit"}[r["badge"]]
    return '<span class="badge %s" title="%s">%s%s</span>' % (r["badge"], esc(title), esc("%d/%s" % (r["used"], cap if cap is not None else "-")),
                                                            " weak CTA" if r.get("weak_default") else "")


class Page:
    def __init__(self, doc, results):
        self.doc, self.by_key = doc, {r["key"]: r for r in results}
        self.heads = []

    def head(self, level, text):
        if text:
            self.heads.append((level, text))

    def button(self, cta, kind):
        if not isinstance(cta, dict) or not cta.get("label"):
            return ""
        return '<a class="btn %s" href="%s">%s</a>%s' % (kind, esc(safe_href(cta.get("href"))), esc(cta["label"]),
                                                       badge_html(self.by_key.get("btn:" + cta["label"])))

    def triggers(self, s):
        items = s.get("triggers") or []
        return '<ul class="triggers body-copy">%s</ul>' % "".join("<li>%s</li>" % esc(t) for t in items) if items else ""

    def render(self, s) -> str:
        t = s["type"]
        h = getattr(self, "s_" + t)
        return h(s)

    def s_hero(self, s):
        self.head(1, s.get("headline"))
        self.head(0, "[button] " + s["cta"]["label"])
        return ('<section id="hero">%s<h1>%s</h1>%s<div>%s%s</div>%s</section>' % (
            '<p class="eyebrow body-copy">%s</p>' % esc(s["eyebrow"]) if s.get("eyebrow") else "", esc(s["headline"]),
            '<p class="sub body-copy">%s</p>' % esc(s["subheadline"]) if s.get("subheadline") else "",
            self.button(s.get("cta"), "primary"), self.button(s.get("secondary_cta"), "secondary"), self.triggers(s)))

    def s_proof_bar(self, s):
        stats = "".join('<div><div class="stat">%s</div><div class="small">%s</div></div>' % (esc(i["value"]), esc(i["label"]))
                        for i in s.get("items", []))
        logos = '<div class="logos">%s</div>' % "".join("<span>%s</span>" % esc(x) for x in s.get("logos", [])) if s.get("logos") else ""
        return '<section id="proof" class="body-copy">%s<div class="grid">%s</div></section>' % (logos, stats)

    def s_problem(self, s):
        self.head(2, s["headline"])
        return '<section id="problem"><h2>%s</h2>%s</section>' % (
            esc(s["headline"]), "".join('<p class="body-copy">%s</p>' % esc(p) for p in s.get("body", [])))

    def s_benefits(self, s):
        self.head(2, s["headline"])
        cards = []
        for i in s["items"]:
            self.head(3, i["title"])
            cards.append('<div class="card"><h3>%s</h3><p class="body-copy">%s</p>%s</div>' % (
                esc(i["title"]), esc(i["body"]), '<p class="proofline body-copy">%s</p>' % esc(i["proof"]) if i.get("proof") else ""))
        return '<section id="benefits"><h2>%s</h2><div class="grid">%s</div></section>' % (esc(s["headline"]), "".join(cards))

    def s_how_it_works(self, s):
        self.head(2, s["headline"])
        steps = []
        for n, i in enumerate(s["steps"], 1):
            self.head(3, "%d. %s" % (n, i["title"]))
            steps.append('<div class="card"><h3>%d. %s</h3>%s</div>' % (
                n, esc(i["title"]), '<p class="body-copy">%s</p>' % esc(i["body"]) if i.get("body") else ""))
        return '<section id="how"><h2>%s</h2><div class="grid">%s</div></section>' % (esc(s["headline"]), "".join(steps))

    def s_testimonials(self, s):
        self.head(2, s.get("headline"))
        qs = "".join('<blockquote class="body-copy"><p>&ldquo;%s&rdquo;</p><footer>%s</footer></blockquote>' % (
            esc(i["quote"]), esc(", ".join(x for x in (i["name"], i.get("role"), i.get("company")) if x))) for i in s["items"])
        head = "<h2>%s</h2>" % esc(s["headline"]) if s.get("headline") else ""
        return '<section id="testimonials">%s<div class="grid">%s</div></section>' % (head, qs)

    def s_pricing(self, s):
        self.head(2, s.get("headline"))
        cards = []
        for p in s["plans"]:
            self.head(3, "%s %s" % (p["name"], p["price"]))
            if isinstance(p.get("cta"), dict) and p["cta"].get("label"):
                self.head(0, "[button] " + p["cta"]["label"])
            cards.append('<div class="card"><h3>%s%s</h3><div class="price">%s <span class="small">%s</span></div><p>%s</p>%s%s</div>' % (
                esc(p["name"]), ' <span class="tag">Recommended</span>' if p.get("recommended") else "", esc(p["price"]), esc(p.get("period", "")),
                esc(p.get("for_whom", "")), '<ul class="body-copy">%s</ul>' % "".join("<li>%s</li>" % esc(f) for f in p.get("features", [])),
                self.button(p.get("cta"), "primary" if p.get("recommended") else "secondary")))
        head = "<h2>%s</h2>" % esc(s["headline"]) if s.get("headline") else ""
        return '<section id="pricing">%s<div class="grid">%s</div></section>' % (head, "".join(cards))

    def s_faq(self, s):
        self.head(2, s.get("headline"))
        qs = "".join('<details class="q" open><summary>%s</summary><p class="body-copy">%s</p></details>' % (esc(i["q"]), esc(i["a"]))
                     for i in s["items"])
        head = "<h2>%s</h2>" % esc(s["headline"]) if s.get("headline") else ""
        return '<section id="faq">%s%s</section>' % (head, qs)

    def s_final_cta(self, s):
        self.head(2, s["headline"])
        self.head(0, "[button] " + s["cta"]["label"])
        return '<section id="final"><h2>%s</h2>%s<div>%s</div>%s</section>' % (
            esc(s["headline"]), '<p class="sub body-copy">%s</p>' % esc(s["body"]) if s.get("body") else "", self.button(s["cta"], "primary"),
            self.triggers(s))


def cut_span(r) -> str:
    return esc(r["visible_text"]) + ('<span class="cut">%s</span>' % esc(r["hidden_text"]) if r["hidden_text"] else "")


def checks_panel(results) -> str:
    n = {k: sum(1 for r in results if r["badge"] == k) for k in ("pass", "warn", "fail")}
    rows = []
    for r in results:
        note = {"pass": "OK", "warn": "cut: %d characters fall outside what the reader sees" % r["over_by"],
                "fail": "over the hard limit by %d" % r["over_by"]}[r["badge"]]
        if r["weak_default"]:
            note += "; weak CTA default, name the value instead"
        rows.append("<tr><td>%s</td><td>%s</td><td>%s</td><td class='small'>%s</td></tr>" % (esc(r["label"]), cut_span(r), badge_html(r), esc(note)))
    body = ("<table><tr><th>Field</th><th>Text (struck-through part is cut off)</th><th>Used</th><th>Result</th></tr>%s</table>" % "".join(rows)
            if rows else "<p class='small'>No checkable fields.</p>")
    return ('<details class="panel" open><summary>Limit checks: %d pass, %d cut, %d over</summary>%s'
            '<p class="small">Limits change. Verify in the platform preview before a large spend.</p></details>' % (n["pass"], n["warn"], n["fail"], body))


def serp_panel(by_key, meta) -> str:
    t, d = by_key.get("meta.title"), by_key.get("meta.description")
    if not t and not d:
        return ""
    title = (t["visible_text"] + ("..." if t["hidden_text"] else "")) if t else ""
    desc = (d["visible_text"] + ("..." if d["hidden_text"] else "")) if d else ""
    return ('<details class="panel serp" open><summary>Search result preview</summary><div class="u">%s</div><div class="t">%s%s</div>'
            '<div class="d">%s%s</div></details>' % (esc(meta.get("url") or "example.com"), esc(title), badge_html(t), esc(desc), badge_html(d)))


def build_html(doc, results) -> str:
    meta = doc.get("meta") or {}
    accent = (doc.get("theme") or {}).get("accent") or "#1d4ed8"
    pg = Page(doc, results)
    sections = "".join(pg.render(s) for s in doc["sections"])
    heads = "".join('<li style="margin-left:%dpx">%s</li>' % (max(0, pg_level - 1) * 16, esc(txt))
                    for pg_level, txt in pg.heads)
    notice = '<div class="notice">%s</div>' % esc(meta["draft_notice"]) if meta.get("draft_notice") else ""
    brand = esc(meta.get("brand") or "Untitled page")
    return ('<!doctype html><html lang="%s"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Copy preview: %s</title><style>%s</style></head><body>'
            '<header class="bar"><strong>Copy preview: %s</strong>'
            '<button type="button" id="skim" aria-pressed="false">Skim test</button>'
            '<button type="button" id="mobile" aria-pressed="false">Mobile width</button>'
            '<button type="button" id="badges" aria-pressed="false">Hide badges</button></header>'
            '<main class="wrap">%s%s%s<details class="panel"><summary>What a skimmer reads (%d lines)</summary><ol class="small">%s</ol>'
            '<p class="small">If these lines alone do not carry the argument, fix the section headlines before the body copy.</p></details>'
            '<div class="frame" id="frame"><div class="page">%s</div></div></main><script>%s</script></body></html>'
            % (esc(meta.get("lang") or "en"), brand, CSS.replace("__ACCENT__", accent), brand, notice, checks_panel(results),
               serp_panel(pg.by_key, meta), len(pg.heads), heads, sections, JS))


# --------------------------------------------------------------------------- cli

def judgment_warnings(doc) -> list:
    out, secs = [], doc.get("sections", [])
    types = [s.get("type") for s in secs]
    if "hero" not in types:
        out.append("no hero section: the page has no claim above the fold")
    hero = next((s for s in secs if s.get("type") == "hero"), None)
    fin = next((s for s in secs if s.get("type") == "final_cta"), None)
    if hero and fin and hero["cta"].get("label", "").strip().lower() != fin["cta"].get("label", "").strip().lower():
        out.append("hero and final CTA ask for different things ('%s' vs '%s'): one page, one action"
                   % (hero["cta"].get("label"), fin["cta"].get("label")))
    for s in secs:
        if s.get("type") == "benefits" and len(s.get("items", [])) > 5:
            out.append("benefits has %d items: 3 to 5 land, more dilute the claim" % len(s["items"]))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="preview.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("copy", help="page copy JSON (see assets/example-copy.json), or - for stdin")
    ap.add_argument("--out", default="preview.html", help="HTML file to write (default preview.html; - for stdout)")
    ap.add_argument("--validate-only", action="store_true", help="check the file against the schema and stop")
    ap.add_argument("--json", action="store_true", help="print the check summary as JSON")
    a = ap.parse_args(argv)
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        doc = normalise(load_doc(a.copy))
        errs, warns = [], []
        validate(doc, load_schema(), "", load_schema(), errs, warns)
        if errs:
            sys.stderr.write("preview: %d problem%s in %s\n" % (len(errs), "" if len(errs) == 1 else "s", a.copy))
            for e in errs:
                sys.stderr.write("  - %s\n" % e)
            return 1
        warns += judgment_warnings(doc)
        for w in warns:
            sys.stderr.write("warning: %s\n" % w)
        results = run_checks(doc)
        counts = {k: sum(1 for r in results if r["badge"] == k) for k in ("pass", "warn", "fail")}
        summary = {"valid": True, "warnings": warns, "counts": counts, "out": None,
                   "checks": [{"label": r["label"], "status": r["status"], "used": r["used"], "limit": r["limit"], "visible": r["visible"]}
                              for r in results]}
        if not a.validate_only:
            page = build_html(doc, results)
            if a.out == "-":
                sys.stdout.write(page)
            else:
                with open(a.out, "w", encoding="utf-8") as fh:
                    fh.write(page)
                summary["out"] = a.out
        if a.json:
            print(json.dumps(summary, indent=2, ensure_ascii=False))
        elif a.out != "-" or a.validate_only:
            msg = "valid" if a.validate_only else "wrote %s (%d KB)" % (a.out, max(1, os.path.getsize(a.out) // 1024))
            print("%s: %d pass, %d cut, %d over the hard limit" % (msg, counts["pass"], counts["warn"], counts["fail"]))
        return 1 if counts["fail"] else 0
    except UsageError as ex:
        sys.stderr.write("preview: %s\n" % ex)
        return 2
    except OSError as ex:
        sys.stderr.write("preview: cannot write %s (%s)\n" % (a.out, ex.strerror or ex))
        return 2
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    sys.exit(main())
