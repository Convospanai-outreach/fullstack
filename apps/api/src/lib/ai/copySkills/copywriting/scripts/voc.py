#!/usr/bin/env python3
"""voc.py: mine the customer's own words from reviews, tickets, interviews and call notes.

Subcommand
  mine FILE... [--ours PAGE.txt]   recurring phrases, pain/desire/outcome/objection/trigger sentences,
                                   a quote bank with source ids, and the vocabulary gap against your page

Accepted inputs: .txt .md .srt .vtt (paragraphs), .csv (one row per record), .json / .jsonl (strings or objects),
or - for stdin. For CSV/JSON the text column is auto-detected; force it with --column. For call or interview
transcripts use --speaker customer to keep only the customer's lines.

Examples
  python3 scripts/voc.py mine reviews.csv tickets.csv
  python3 scripts/voc.py mine calls/*.txt --speaker customer --ours landing-page.txt
  python3 scripts/voc.py mine interviews.md --json > voc.json

Exit codes: 0 ok, 1 no usable text found, 2 usage error. Cue-based and deterministic: it finds candidates,
you judge them. Sentences with emails, phone numbers or links are kept out of the quote bank.
No network. Standard library only.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

csv.field_size_limit(min(sys.maxsize, 2 ** 31 - 1))


class UsageError(Exception):
    pass


TEXT_COLUMNS = ["review", "review_text", "text", "body", "comment", "comments", "feedback", "message", "content", "description",
                "note", "notes", "response", "answer", "quote", "transcript", "ticket", "summary", "details", "verbatim"]
ID_COLUMNS = ["id", "review_id", "ticket_id", "ticket", "case_id", "response_id", "record_id", "reference"]

STOP = set("""a about above after again against all also am an and any are aren't as at be because been before being below between both but by
can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't
having he her here hers herself him himself his how i i'd i'll i'm i've if in into is isn't it it's its itself just let's me more most mustn't
my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she should shouldn't so some such than that
that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up
very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will with
won't would wouldn't you you'd you'll you're you've your yours yourself yourselves get got getting really actually thing things one two like
lot much many even still yes yeah ok okay well also just now""".split())
WEAK = set("last need needs use used using make made work works worked good great time come go going want wants new tool tools way ways "
           "thing product people day days back first next every each another such own same able try tried find found take took give".split())
FILLER = {"thank you", "thanks for", "thanks a lot", "let me know", "look forward", "best regards", "kind regards", "hi there", "hello team",
          "please let", "let us know", "thanks so much", "thank you so much"}

CUES = {
    "pain": r"frustrat\w*|annoy\w*|\bhate[ds]?\b|struggl\w*|\bwast(?:e|es|ed|ing)\b|painful|nightmare|tedious|\bmanual(?:ly)?\b|confus\w*|"
            r"\b(?:can't|cannot|couldn't|unable to)\b|too (?:slow|long|expensive|complicated|much|many|hard)|takes? (?:forever|hours|ages|too long)|"
            r"\bbroken\b|keeps? (?:breaking|crashing|failing)|no way to|sick of|tired of|overwhelm\w*|\bstuck\b|lost (?:hours|time|money|deals|track)|"
            r"\bfail(?:s|ed|ing|ure)\b|\bhours (?:on|every|each|per)\b|spen[dt](?:ing)? (?:hours|too much|so much)|pain point|hard to|difficult|impossible|"
            r"\bworst\b|\bugly\b|clunky|\bmess\b|chaos",
    "desire": r"\bi wish\b|\bwish (?:it|there|you|we)\b|\bi want\b|\bwe want\b|\bi need\b|\bwe need\b|looking for|would love|would be (?:great|nice|helpful|amazing)|"
              r"if only|\bideally\b|hoping (?:to|for)|want to be able|need to be able|\bdream\b|should be able|\bwant(?:ed)? (?:a|an|to|something)\b",
    "outcome": r"\bsav(?:ed|es|ing)\b|now (?:i|we) can|\bfinally\b|went from|from [\d$][^.]{0,25} to [\d$]|cut (?:[^.]{0,20})(?:in half|by)|doubled|tripled|halved|"
               r"\bno longer\b|instead of|\b(?:increase[ds]?|reduce[ds]?|improved|boosted|grew)\b|\d+ ?%|\bfaster\b|worth it|highly recommend|"
               r"\b(?:love|loved) (?:it|this|how|that)\b|life[- ]?saver|game[- ]?changer|\b(?:hours|days|weeks) (?:a|per|each|every) (?:day|week|month)\b|paid for itself|"
               r"\bwithin (?:a|an|\d+) (?:day|week|hour|month|minute)s?\b",
    "objection": r"expensive|pricey|costs? too|\bnot sure\b|\bworried\b|concern\w*|afraid|skeptic\w*|sceptic\w*|\bdoubt\w*|(?:don't|do not) trust|\bwhat if\b|"
                 r"how do (?:i|we) know|lock(?:ed)?[- ]?in|hidden (?:fees|costs?)|\bcancel\w*|\brefund\w*|switching (?:cost|is|from)|already (?:use|have|using)|"
                 r"not worth|can't afford|no time to|learning curve|too good to be true|\bscam\b|does it (?:work|integrate|support)|\bsteep\b",
    "trigger": r"decided to|finally decided|that's when|last straw|started (?:when|after)|\bwe (?:just )?(?:hired|launched|raised|lost|switched|migrated|grew|outgrew)\b|"
               r"new (?:job|role|boss|manager|regulation|law|quarter)|\bdeadline\b|\baudit\b|\brenewal\b|ran out|hit a wall|got (?:fired|promoted|acquired|audited)|"
               r"tipping point|moving from|\boutgrew\b|\bwhen (?:my|our|the) [^.]{0,40}(?:broke|failed|left|quit|ended|hit|changed|doubled)\b|last (?:week|month|quarter|year),? (?:i|we)\b",
}
CUE_RX = {k: re.compile(v, re.I) for k, v in CUES.items()}
EMOTION = re.compile(r"\b(?:love|hate|finally|wish|nightmare|exactly|honestly|literally|terrible|amazing|horrible|obsessed|relief|panic|dread|thrilled)\w*", re.I)
PII = re.compile(r"https?://|www\.|[\w.+-]+@[\w-]+\.\w+|\+?\d[\d\s().-]{8,}\d")
TOKEN = re.compile(r"[a-z0-9]+(?:['\u2019][a-z]+)?")


def decode(raw: bytes) -> str:
    return raw.decode("utf-8-sig", errors="replace").replace("\r\n", "\n").replace("\r", "\n")


def norm_ws(s: str) -> str:
    return " ".join(s.split())


# --------------------------------------------------------------------------- loading

def pick_column(fieldnames, rows, forced):
    if forced:
        for f in fieldnames:
            if f and f.strip().lower() == forced.strip().lower():
                return f
        raise UsageError("column '%s' not found. Columns: %s" % (forced, ", ".join(x for x in fieldnames if x)))
    low = {(f or "").strip().lower(): f for f in fieldnames}
    for c in TEXT_COLUMNS:
        if c in low:
            return low[c]
    best, best_len = None, 0.0
    for f in fieldnames:
        vals = [str(r.get(f) or "") for r in rows[:200]]
        avg = sum(len(v) for v in vals) / float(len(vals) or 1)
        if avg > best_len:
            best, best_len = f, avg
    return best


def records_from_rows(rows, fieldnames, name, forced):
    if not rows:
        return []
    col = pick_column(fieldnames, rows, forced)
    idcol = next((f for f in fieldnames if f and f.strip().lower() in ID_COLUMNS), None)
    out = []
    for i, r in enumerate(rows, 1):
        t = str(r.get(col) or "").strip()
        if t:
            rid = str(r.get(idcol)).strip() if idcol and r.get(idcol) else "row%d" % i
            out.append({"src": "%s:%s" % (name, rid), "text": t})
    return out


def records_from_json(data, name, forced):
    if isinstance(data, dict):
        lists = [v for v in data.values() if isinstance(v, list)]
        data = lists[0] if lists else [data]
    if not isinstance(data, list):
        return []
    if all(isinstance(x, str) for x in data):
        return [{"src": "%s:#%d" % (name, i), "text": x.strip()} for i, x in enumerate(data, 1) if x.strip()]
    rows = [x for x in data if isinstance(x, dict)]
    fields = []
    for r in rows[:200]:
        for k in r:
            if k not in fields:
                fields.append(k)
    return records_from_rows(rows, fields, name, forced)


SPEAKER = re.compile(r"^\s*(?:\[[^\]]*\]\s*)?(?:\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s*)?([A-Za-z][\w .'-]{0,30}?)\s*[:\-]\s+(.*)$")


def records_from_text(text, name, speaker):
    text = re.sub(r"(?m)^WEBVTT.*$", "", text)
    text = re.sub(r"(?m)^\s*\d+\s*$", "", text)
    text = re.sub(r"(?m)^.*\d\d:\d\d:\d\d[.,]\d+\s*-->.*$", "", text)
    lines = text.split("\n")
    out, buf, start, current = [], [], 0, None

    def flush():
        if buf:
            t = norm_ws(" ".join(buf))
            if t:
                out.append({"src": "%s:L%d" % (name, start), "text": t})
        del buf[:]

    for i, line in enumerate(lines, 1):
        if not line.strip() or re.match(r"^\s*(?:---+|===+|\*\*\*+)\s*$", line):
            flush()
            continue
        if speaker:
            m = SPEAKER.match(line)
            if m:
                flush()
                current = m.group(1).strip().lower()
                line = m.group(2)
                start = i
            if current is None or speaker.lower() not in current:
                continue
        if not buf:
            start = i
        buf.append(line.strip())
    flush()
    return out


def load_records(paths, forced_col, speaker):
    recs = []
    for p in paths:
        if p == "-":
            raw, name = decode(sys.stdin.buffer.read()), "stdin"
        else:
            if not os.path.isfile(p):
                raise UsageError("file not found: %s" % p)
            with open(p, "rb") as fh:
                raw = decode(fh.read())
            name = os.path.basename(p)
        ext = os.path.splitext(name)[1].lower()
        if ext == ".csv":
            rd = csv.DictReader(raw.splitlines())
            rows = list(rd)
            recs += records_from_rows(rows, rd.fieldnames or [], name, forced_col)
        elif ext == ".json":
            try:
                recs += records_from_json(json.loads(raw), name, forced_col)
            except ValueError as ex:
                raise UsageError("%s is not valid JSON (%s)" % (name, ex))
        elif ext == ".jsonl":
            items = []
            for ln in raw.split("\n"):
                if ln.strip():
                    try:
                        items.append(json.loads(ln))
                    except ValueError:
                        raise UsageError("%s has a line that is not valid JSON" % name)
            recs += records_from_json(items, name, forced_col)
        else:
            recs += records_from_text(raw, name, speaker)
    return recs


# --------------------------------------------------------------------------- text tools

SENT_SPLIT = re.compile(r"(?<=[.!?])[\"')\]\u201d]*\s+")


def sentences(text: str) -> list:
    out = []
    for part in SENT_SPLIT.split(text):
        part = norm_ws(part)
        if part:
            out.append(part)
    return out


def tokens(s: str) -> list:
    return [t.replace("\u2019", "'") for t in TOKEN.findall(s.lower().replace("\u2019", "'"))]


def stem(w: str) -> str:
    w = w.replace("'s", "")
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 5 and w.endswith("ing"):
        return w[:-3]
    if len(w) > 4 and w.endswith("ed"):
        return w[:-2]
    if len(w) > 4 and w.endswith("es"):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


# --------------------------------------------------------------------------- mining

def clip(s: str, n: int = 180) -> str:
    return s if len(s) <= n else s[: n - 3].rstrip() + "..."


def prepare(recs):
    for r in recs:
        r["_sent"] = sentences(r["text"])
        r["_tok"] = [tokens(s) for s in r["_sent"]]


def mine_phrases(recs, min_count: int, top: int):
    df = Counter()
    for r in recs:
        seen = set()
        for st in r["_tok"]:
            seen.update(t for t in st if t not in STOP and len(t) > 2)
        df.update(seen)
    keep = {t for t, c in df.items() if c >= min_count}
    docs, uses, ex = defaultdict(set), Counter(), defaultdict(list)
    for ri, r in enumerate(recs):
        for si, st in enumerate(r["_tok"]):
            for n in (2, 3, 4):
                for i in range(len(st) - n + 1):
                    g = st[i:i + n]
                    if g[0] in STOP or g[-1] in STOP or len(g[0]) < 2 or len(g[-1]) < 2 or g[-1] in WEAK:
                        continue
                    if any(t not in STOP and t not in keep for t in g):
                        continue
                    if all(t.isdigit() for t in g):
                        continue
                    key = " ".join(g)
                    if key in FILLER:
                        continue
                    docs[key].add(ri)
                    uses[key] += 1
                    if len(ex[key]) < 3:
                        ex[key].append((ri, si))
    cands = [k for k in docs if len(docs[k]) >= min_count]
    cands.sort(key=lambda k: (-len(docs[k]), -len(k.split()), -uses[k], k))
    cands = cands[:2000]
    cands.sort(key=lambda k: (-len(k.split()), -len(docs[k]), k))
    kept = []
    for k in cands:
        padded = " " + k + " "
        if any(padded in " " + q + " " and len(docs[q]) >= 0.75 * len(docs[k]) for q in kept if len(q.split()) > len(k.split())):
            continue
        kept.append(k)
    kept.sort(key=lambda k: (-len(docs[k]), -len(k.split()), -uses[k], k))
    out = []
    for k in kept[:top]:
        best = min(ex[k], key=lambda x: len(recs[x[0]]["_sent"][x[1]]))
        r = recs[best[0]]
        out.append({"phrase": k, "records": len(docs[k]), "uses": uses[k], "example": clip(r["_sent"][best[1]]), "src": r["src"]})
    return out, df


def classify(recs, per_cat: int) -> dict:
    cats = {c: [] for c in CUES}
    for r in recs:
        for s in r["_sent"]:
            w = len(s.split())
            if w < 5 or w > 45:
                continue
            for c, rx in CUE_RX.items():
                found = sorted({m.group(0).lower() for m in rx.finditer(s)})
                if found:
                    strength = len(found) + (1 if re.search(r"\d", s) else 0) + (0.5 if re.search(r"\b(?:i|we|my|our)\b", s, re.I) else 0)
                    cats[c].append((strength, w, s, r["src"], found))
    out = {}
    for c, items in cats.items():
        items.sort(key=lambda x: (-x[0], x[1], x[2]))
        top, seen = [], []
        for strength, w, s, src, found in items:
            toks = set(tokens(s)) - STOP
            if any(len(toks & o) / float(len(toks | o) or 1) > 0.6 for o in seen):
                continue
            seen.append(toks)
            top.append({"text": clip(s, 220), "src": src, "cues": found[:4]})
            if len(top) >= per_cat:
                break
        out[c] = {"count": len(items), "top": top}
    return out


def quote_bank(recs, n: int) -> list:
    cand = []
    for r in recs:
        for s in r["_sent"]:
            w = len(s.split())
            if w < 6 or w > 24 or PII.search(s):
                continue
            tags = [c for c, rx in CUE_RX.items() if rx.search(s)]
            emo = 1 if EMOTION.search(s) else 0
            if not tags and not emo:
                continue
            score = 2 * len(tags) + emo + (1 if re.search(r"\d", s) else 0) + (1 if re.search(r"\b(?:i|we|my|our)\b", s, re.I) else 0)
            cand.append((score, w, s, r["src"], tags))
    cand.sort(key=lambda x: (-x[0], x[1], x[2]))
    chosen, per_src, seen = [], Counter(), []
    for score, w, s, src, tags in cand:
        toks = set(tokens(s)) - STOP
        if per_src[src] >= 2 or any(len(toks & o) / float(len(toks | o) or 1) > 0.6 for o in seen):
            continue
        chosen.append({"text": s, "src": src, "tags": tags})
        per_src[src] += 1
        seen.append(toks)
        if len(chosen) >= n:
            break
    return chosen


def present(stems_list, pos, k):
    if not stems_list or any(s not in pos for s in stems_list):
        return False
    for i in pos[stems_list[0]]:
        window = set(pos["__seq__"][max(0, i - k): i + k + 1])
        if all(s in window for s in stems_list):
            return True
    return False


def load_kill_forms() -> set:
    try:
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "..", "assets", "kill-list.json"), encoding="utf-8") as fh:
            d = json.load(fh)
        return {f.lower() for sec in ("words", "phrases") for e in d.get(sec, []) for f in e["forms"] if " " not in f}
    except (OSError, ValueError, KeyError):
        return set()


def vocab_gap(recs, phrases, df, page_text: str, top: int, min_count: int) -> dict:
    ptoks = [stem(t) for t in tokens(page_text)]
    if len(ptoks) < 5:
        raise UsageError("the --ours page is empty or too short")
    pos = defaultdict(list)
    for i, t in enumerate(ptoks):
        pos[t].append(i)
    pos["__seq__"] = ptoks
    missing, hit = [], 0
    checked = 0
    for p in phrases[:60]:
        st = [stem(t) for t in p["phrase"].split() if t not in STOP]
        checked += 1
        if present(st, pos, len(p["phrase"].split()) + 2):
            hit += 1
        else:
            missing.append({"term": p["phrase"], "records": p["records"]})
    singles = [(w, c) for w, c in df.items() if c >= max(3, min_count) and len(w) > 3 and w not in WEAK]
    singles.sort(key=lambda x: (-x[1], x[0]))
    covered = {stem(t) for p in phrases for t in p["phrase"].split()}
    for w, c in singles[:60]:
        if stem(w) in covered:
            continue
        if stem(w) not in pos:
            missing.append({"term": w, "records": c})
    missing.sort(key=lambda m: (-m["records"], m["term"]))
    cust = set()
    total_cust = 0
    for r in recs:
        for st in r["_tok"]:
            total_cust += len(st)
            cust.update(stem(t) for t in st)
    kill = load_kill_forms()
    jargon = []
    if total_cust >= 150:
        counts = Counter(t for t in tokens(page_text) if t not in STOP and len(t) > 3 and not t.isdigit())
        for w, c in counts.items():
            if stem(w) in cust:
                continue
            k = w in kill
            if c >= 2 or k:
                jargon.append({"term": w, "on_page": c, "kill_list": k})
        jargon.sort(key=lambda j: (not j["kill_list"], -j["on_page"], j["term"]))
    return {"phrase_coverage": "%d of %d top customer phrases appear on the page" % (hit, checked),
            "customers_say_page_does_not": missing[:top], "page_says_customers_never_do": jargon[:top],
            "small_sample_warning": total_cust < 150}


# --------------------------------------------------------------------------- output

LABELS = {"pain": "PAIN (what hurts today)", "desire": "DESIRE (what they want)", "outcome": "OUTCOME (what changed)",
          "objection": "OBJECTION (what holds them back)", "trigger": "TRIGGER (why now)"}


def render(res: dict) -> str:
    out = ["VOICE OF CUSTOMER: %d files, %d records, %d sentences, %d words" %
           (len(res["files"]), res["records"], res["sentences"], res["words"])]
    out.append("\nTOP PHRASES (customers' own words; records = how many separate people used it)")
    if not res["phrases"]:
        out.append("  none recurring: not enough overlap yet (try --min-count 1 or add more material)")
    for i, p in enumerate(res["phrases"], 1):
        out.append('%3d. "%s"  (%d records, %d uses)  e.g. "%s" [%s]' % (i, p["phrase"], p["records"], p["uses"], p["example"], p["src"]))
    for c in CUES:
        blk = res["categories"][c]
        out.append("\n%s: %d sentence%s matched" % (LABELS[c], blk["count"], "" if blk["count"] == 1 else "s"))
        for it in blk["top"]:
            out.append('  - "%s" [%s]' % (it["text"], it["src"]))
    out.append("\nQUOTE BANK (short verbatim lines, strongest first)")
    for i, q in enumerate(res["quotes"], 1):
        out.append('%3d. "%s" [%s]%s' % (i, q["text"], q["src"], "  (" + ", ".join(q["tags"]) + ")" if q["tags"] else ""))
    if not res["quotes"]:
        out.append("  none: no short sentences with clear pain, desire, outcome or emotion cues")
    g = res.get("gap")
    if g:
        out.append("\nVOCABULARY GAP vs your page (" + g["phrase_coverage"] + ")")
        out.append("  Customers say, your page does not:")
        out.extend("    - %s (%d records)" % (m["term"], m["records"]) for m in g["customers_say_page_does_not"])
        out.append("  Your page says, customers never do (in this sample):")
        out.extend("    - %s (x%d on page)%s" % (j["term"], j["on_page"], "  [kill-list]" if j["kill_list"] else "")
                   for j in g["page_says_customers_never_do"])
        if g["small_sample_warning"]:
            out.append("  Note: under 150 customer words, the page-jargon list was skipped. Add more material.")
        else:
            out.append("  A sample overstates the gap. Read each term before swapping; keep words customers do not use only if they are precise.")
    out.append("\nUse these as raw material. Quote customers only with permission, and never fabricate a testimonial from a phrase.")
    return "\n".join(out)


def cmd_mine(a) -> int:
    recs = load_records(a.files, a.column, a.speaker)
    if not recs:
        sys.stderr.write("voc: no usable customer text found%s\n" % (" for speaker '%s'" % a.speaker if a.speaker else ""))
        return 1
    prepare(recs)
    phrases, df = mine_phrases(recs, a.min_count, a.top)
    res = {"files": sorted({r["src"].rsplit(":", 1)[0] for r in recs}), "records": len(recs),
           "sentences": sum(len(r["_sent"]) for r in recs), "words": sum(len(t) for r in recs for t in r["_tok"]),
           "phrases": phrases, "categories": classify(recs, a.per_category), "quotes": quote_bank(recs, a.quotes)}
    if a.ours:
        if not os.path.isfile(a.ours):
            raise UsageError("file not found: %s" % a.ours)
        with open(a.ours, "rb") as fh:
            res["gap"] = vocab_gap(recs, phrases, df, decode(fh.read()), a.top, a.min_count)
    if a.json:
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print(render(res))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="voc.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    m = sub.add_parser("mine", help="mine customer text for phrases, cue sentences, quotes and the vocabulary gap")
    m.add_argument("files", nargs="+", help="input files, or - for stdin")
    m.add_argument("--ours", metavar="PAGE", help="your page or draft (text or markdown) to compare vocabulary against")
    m.add_argument("--column", help="CSV/JSON field holding the text (auto-detected by default)")
    m.add_argument("--speaker", help="for transcripts: keep only lines by this speaker label, for example customer")
    m.add_argument("--top", type=int, default=25, help="phrases and gap terms to show (default 25)")
    m.add_argument("--quotes", type=int, default=15, help="quote bank size (default 15)")
    m.add_argument("--per-category", type=int, default=5, help="sentences shown per category (default 5)")
    m.add_argument("--min-count", type=int, default=2, help="a phrase must occur in this many records (default 2)")
    m.add_argument("--json", action="store_true")
    m.set_defaults(fn=cmd_mine)
    a = ap.parse_args(argv)
    if not getattr(a, "fn", None):
        ap.print_help()
        return 2
    if a.min_count < 1 or a.top < 1 or a.quotes < 0 or a.per_category < 1:
        sys.stderr.write("voc: --min-count, --top and --per-category must be at least 1\n")
        return 2
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        return a.fn(a)
    except UsageError as ex:
        sys.stderr.write("voc: %s\n" % ex)
        return 2
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    sys.exit(main())
