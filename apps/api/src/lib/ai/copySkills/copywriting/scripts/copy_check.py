#!/usr/bin/env python3
"""copy_check.py: mechanical checks for marketing copy (limits, metrics, test sizing).

Subcommands
  fit PLATFORM FIELD TEXT|FILE|-   characters used vs limit, plus a preview of where the reader's view is cut
  specs [PLATFORM]                 list platforms and fields, or the fields of one platform
  score FILE|- [--headlines FILE]  plain metrics and flags for a piece of copy; ranks headline candidates
  abtest --baseline 3.2% --lift 20% --visitors-per-week 800   sample size, weeks needed, honest verdict

Examples
  python3 scripts/copy_check.py fit google-ads rsa-headline "Free shipping on every order over $50"
  python3 scripts/copy_check.py fit linkedin post draft.txt
  python3 scripts/copy_check.py fit google-ads rsa-headline headlines.txt --lines
  python3 scripts/copy_check.py score page.txt --headlines options.txt
  python3 scripts/copy_check.py abtest --baseline 3.2% --lift 20% --visitors-per-week 800

Exit codes: 0 ok, 1 findings (fit over the hard limit, score flags marked FIX), 2 usage error.
Platform limits are a baseline: verify them in the platform's own preview before a large spend.
No network. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
EM = "\u2014"
EN = "–"


class UsageError(Exception):
    pass


# --------------------------------------------------------------------------- io helpers

def load_json(name: str) -> dict:
    p = ASSETS / name
    try:
        return json.loads(p.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as ex:
        raise UsageError("cannot read %s: %s" % (p, ex))


def decode(raw: bytes) -> str:
    text = raw.decode("utf-8-sig", errors="replace")
    return text.replace("\r\n", "\n").replace("\r", "\n")


def read_arg(arg: str, literal_ok: bool = True) -> str:
    """'-' reads stdin, an existing file path is read, otherwise (if literal_ok) the string itself."""
    if arg == "-":
        return decode(sys.stdin.buffer.read())
    try:
        if os.path.isfile(arg):
            with open(arg, "rb") as fh:
                return decode(fh.read())
    except (OSError, ValueError):
        pass
    if literal_ok:
        return arg.replace("\r\n", "\n")
    raise UsageError("file not found: %s" % arg)


def emit_json(obj) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=False))


def pct(x: float, digits: int = 1) -> str:
    return ("%." + str(digits) + "f%%") % (x * 100)


# --------------------------------------------------------------------------- fit

ALIASES = {
    "google": "google-ads", "googleads": "google-ads", "adwords": "google-ads", "ppc": "google-ads",
    "meta": "meta-ads", "facebook": "meta-ads", "fb": "meta-ads", "facebook-ads": "meta-ads", "instagram-ads": "meta-ads",
    "twitter": "x", "tweet": "x", "ig": "instagram", "insta": "instagram", "yt": "youtube",
    "li": "linkedin", "mail": "email", "newsletter": "email", "og": "open-graph", "opengraph": "open-graph",
    "search": "seo", "appstore": "app-store", "app": "app-store", "notification": "push", "cta": "button",
}

# Arial glyph widths in 1/1000 em for ASCII 32..126, used to estimate pixel width of SEO titles.
ARIAL = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
         556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
         1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
         667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
         333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
         556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]

URL_RE = re.compile(r"https?://\S+|www\.\S+")


def is_wide(ch: str) -> bool:
    o = ord(ch)
    return (0x1100 <= o <= 0x115F or 0x2E80 <= o <= 0xA4CF or 0xAC00 <= o <= 0xD7A3 or 0xF900 <= o <= 0xFAFF
            or 0xFE30 <= o <= 0xFE6F or 0xFF00 <= o <= 0xFF60 or 0xFFE0 <= o <= 0xFFE6 or 0x1F300 <= o <= 0x1FAFF)


def weights_for(text: str, platform: str, field: str) -> list:
    """Per-character cost. Plain characters cost 1. X counts every link as 23 and wide scripts as 2."""
    w = [1] * len(text)
    if platform == "x" and field in ("post", "bio", "display-name"):
        for i, ch in enumerate(text):
            if is_wide(ch):
                w[i] = 2
        if field == "post":
            for m in URL_RE.finditer(text):
                for i in range(m.start(), m.end()):
                    w[i] = 0
                w[m.start()] = 23
    return w


def px_widths(text: str, font_px: float) -> list:
    out = []
    for ch in text:
        o = ord(ch)
        if 32 <= o <= 126:
            u = ARIAL[o - 32]
        elif is_wide(ch):
            u = 1000
        else:
            u = 556
        out.append(u * font_px / 1000.0)
    return out


def resolve(platform: str, field: str, specs: dict):
    keys = [k for k in specs if not k.startswith("_")]
    p = platform.strip().lower().replace("_", "-").replace(" ", "-")
    p = ALIASES.get(p, p)
    if p not in specs or p.startswith("_"):
        cands = [k for k in keys if k.startswith(p)]
        if len(cands) == 1:
            p = cands[0]
        else:
            raise UsageError("unknown platform '%s'. Known: %s" % (platform, ", ".join(keys)))
    fields = specs[p]
    f = field.strip().lower().replace("_", "-").replace(" ", "-")
    if p == "sms" and f in ("auto", "message", "text", "body"):
        f = "gsm-segment"
    if f not in fields:
        cands = [k for k in fields if f in k]
        if len(cands) == 1:
            f = cands[0]
        else:
            raise UsageError("unknown field '%s' for %s. Fields: %s" % (field, p, ", ".join(fields)))
    return p, f, fields[f]


def cut_index(cum_limit: float, w: list) -> int:
    total = 0.0
    for i, x in enumerate(w):
        total += x
        if total > cum_limit + 1e-9:
            return i
    return len(w)


def flat(s: str) -> str:
    return s.replace("\n", "\\n")


def clip_tail(s: str, n: int = 240) -> str:
    s = flat(s)
    return s if len(s) <= n else s[:n] + " ...(%d more characters)" % (len(s) - n)


def fit_one(platform: str, field: str, text: str, specs: dict) -> dict:
    p, f, spec = resolve(platform, field, specs)
    if p == "sms":
        return sms_fit(f, spec, text, specs)
    text = text.strip("\n")
    limit, visible = spec.get("limit"), spec.get("visible")
    w = weights_for(text, p, f)
    used = int(sum(w))
    res = {"platform": p, "field": f, "chars": len(text), "used": used, "limit": limit, "visible": visible,
           "confidence": spec.get("confidence"), "notes": spec.get("notes", "")}
    px_limit = spec.get("px")
    if px_limit:
        pxw = px_widths(text, spec.get("px_font", 20))
        res["est_px"] = round(sum(pxw))
        res["px_limit"] = px_limit
        ci = cut_index(px_limit, pxw)
    elif visible is not None:
        ci = cut_index(visible, w)
    else:
        ci = len(text)
    res["visible_text"], res["hidden_text"] = text[:ci], text[ci:]
    if limit is not None and used > limit:
        res["status"], res["over_by"] = "over", used - limit
    elif ci < len(text):
        res["status"], res["over_by"] = "cut", len(text) - ci
    else:
        res["status"], res["over_by"] = "ok", 0
    if limit is not None:
        res["left"] = limit - used
    elif visible is not None:
        res["left"] = visible - used
    return res


def sms_fit(field: str, spec: dict, text: str, specs: dict) -> dict:
    gsm = ("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ"
           "ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ"
           "ÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
    ext = "^{}\\[~]|€"
    text = text.strip("\n")
    bad = []
    for ch in text:
        if ch not in gsm and ch not in ext and ch not in bad:
            bad.append(ch)
    unicode_mode = bool(bad)
    if unicode_mode:
        used, single, multi = len(text), 70, 67
        enc = "UCS-2 (unicode)"
    else:
        used = sum(2 if c in ext else 1 for c in text)
        single, multi = 160, 153
        enc = "GSM-7"
    segments = 0 if used == 0 else (1 if used <= single else int(math.ceil(used / float(multi))))
    cap = single if segments <= 1 else multi * segments
    res = {"platform": "sms", "field": "message", "chars": len(text), "used": used, "limit": single, "visible": single,
           "encoding": enc, "segments": segments, "left": cap - used, "forced_unicode_by": bad[:8],
           "confidence": spec.get("confidence"), "notes": spec.get("notes", ""),
           "visible_text": text, "hidden_text": ""}
    res["status"] = "ok" if segments <= 1 else "cut"
    res["over_by"] = 0 if segments <= 1 else used - single
    return res


def render_fit(r: dict) -> str:
    head = "%s / %s: %d used" % (r["platform"], r["field"], r["used"])
    if r["limit"] is not None:
        head += " of %d" % r["limit"]
    if r.get("est_px"):
        head += " (about %d px of %d, estimate)" % (r["est_px"], r["px_limit"])
    lines = [head]
    if r["platform"] == "sms":
        lines.append("  encoding: %s, %d segment%s, %d characters left in the last segment"
                     % (r["encoding"], r["segments"], "" if r["segments"] == 1 else "s", r["left"]))
        if r["forced_unicode_by"]:
            lines.append("  forced unicode by: %s (replace them to get back to 160 per segment)"
                         % " ".join(repr(c)[1:-1] for c in r["forced_unicode_by"]))
    verdict = {"ok": "OK", "cut": "CUT", "over": "OVER"}[r["status"]]
    if r["status"] == "over":
        verdict += " by %d over the hard limit" % r["over_by"]
    elif r["status"] == "cut" and r["platform"] != "sms":
        verdict += " (%d characters fall outside what the reader sees)" % r["over_by"]
    elif r["status"] == "cut":
        verdict += " (splits into %d billed segments)" % r["segments"]
    else:
        verdict += ", %s left" % (r["left"] if r.get("left") is not None else "n/a")
    lines.append("  status: " + verdict)
    if r["platform"] != "sms" and (r["hidden_text"] or r["status"] != "ok"):
        lines.append("  sees   : " + flat(r["visible_text"]))
        lines.append("  hidden : " + clip_tail(r["hidden_text"]))
        lines.append("  preview: " + flat(r["visible_text"]) + "<<CUT>>" + clip_tail(r["hidden_text"]))
    if r.get("notes"):
        lines.append("  note   : " + r["notes"])
    lines.append("  confidence: %s (verify in the platform preview before a large spend)" % r["confidence"])
    return "\n".join(lines)


def cmd_fit(a) -> int:
    specs = load_json("platform-specs.json")
    raw = read_arg(a.text)
    items = [ln.strip() for ln in raw.split("\n") if ln.strip()] if a.lines else [raw]
    if not items or not any(x.strip() for x in items):
        raise UsageError("no text to check")
    results = [fit_one(a.platform, a.field, t, specs) for t in items]
    if a.json:
        emit_json({"verify_note": specs["_meta"]["verify_note"], "results": results})
    else:
        print("\n\n".join(render_fit(r) for r in results))
    bad = any(r["status"] == "over" or (a.strict and r["status"] == "cut") for r in results)
    return 1 if bad else 0


def cmd_specs(a) -> int:
    specs = load_json("platform-specs.json")
    keys = [k for k in specs if not k.startswith("_")]
    if a.platform:
        p = ALIASES.get(a.platform.lower(), a.platform.lower())
        if p not in keys:
            raise UsageError("unknown platform '%s'. Known: %s" % (a.platform, ", ".join(keys)))
        keys = [p]
    if a.json:
        emit_json({"_meta": specs["_meta"], **{k: specs[k] for k in keys}})
        return 0
    for k in keys:
        print(k)
        for f, s in specs[k].items():
            lim = "-" if s["limit"] is None else s["limit"]
            vis = "-" if s["visible"] is None else s["visible"]
            print("  %-24s limit %-5s visible %-5s %s" % (f, lim, vis, s["confidence"]))
    print("\n" + specs["_meta"]["verify_note"])
    return 0


# --------------------------------------------------------------------------- score: text primitives

WORD_RE = re.compile(r"[^\W_]+(?:['’\-][^\W_]+)*")
ABBR_RE = re.compile(r"\b(e\.g|i\.e|vs|dr|mr|mrs|ms|inc|ltd|etc|no|st|approx)\.", re.I)
MONTHS = ("january|february|march|april|may|june|july|august|september|october|november|december|"
          "jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec")
NUMWORD = (r"(?:\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|"
           r"thirty|sixty|ninety|half an?)")
TIME_RE = re.compile(
    r"\b(?:" + NUMWORD + r"[\s-]+(?:business[\s-]+|working[\s-]+)?(?:second|minute|hour|day|week|month|year)s?\b"
    r"|overnight|same[\s-]day|next[\s-]day|24/7|(?:" + MONTHS + r")\.?\s+\d{1,2}(?:,?\s+\d{4})?"
    r"|q[1-4](?:\s*\d{4})?|(?:19|20)\d{2}|\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?)\b", re.I)
NUM_RE = re.compile(r"(?<![\w.])[$€£]?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent|k|m|x|bn|b)\b|%)?(?![\w])", re.I)
CAP_STOP = set(("I The A An And But Or So If When We You Your Our It This That These Those In On At For With Without From To "
                "Get Start See Try Join Why How What Who Where No Yes Free New All Every Each Not Now Today Only Sale "
                "FREE NOW NEW SALE ONLY TODAY YOU YOUR OUR WE ").split()
               + "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August "
               "September October November December Jan Feb Mar Apr Jun Jul Aug Sep Sept Oct Nov Dec".split())
DAYS = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
YOU_SET = {"you", "your", "yours", "yourself", "yourselves", "you're", "you'll", "you've", "you'd"}
WE_SET = {"we", "our", "ours", "ourselves", "we're", "we'll", "we've", "we'd"}
I_SET = {"I", "I'm", "I'll", "I've", "I'd", "my", "me", "mine", "myself", "My", "Me"}


class Claimed:
    """Byte mask of text spans already matched, so overlap checks stay linear on big inputs."""

    def __init__(self, n: int):
        self.mask = bytearray(n)

    def overlaps(self, start: int, end: int) -> bool:
        return any(self.mask[start:end])

    def add(self, start: int, end: int) -> None:
        self.mask[start:end] = b"\x01" * (end - start)


def norm_apos(s: str) -> str:
    return s.replace("’", "'")


def strip_markup(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", text, flags=re.M)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)
    text = re.sub(r"[*`]+", "", text)
    text = re.sub(r"(?m)^\s*(?:---+|===+)\s*$", "", text)
    return text


def split_sentences(text: str) -> list:
    out = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        line = ABBR_RE.sub(lambda m: m.group(0)[:-1] + "\x00", line)
        parts = re.split(r"(?<=[.!?])[\"')\]”]*\s+(?=[A-Z0-9\"'(“])", line)
        out.extend(p.replace("\x00", ".").strip() for p in parts if p.strip())
    return out


def words_of(text: str) -> list:
    return WORD_RE.findall(text)


def syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def reading(text: str) -> dict:
    sents = split_sentences(text)
    ws = words_of(text)
    if not ws or not sents:
        return {"words": len(ws), "sentences": len(sents), "grade": None, "ease": None}
    syl = sum(syllables(w) for w in ws)
    wps, spw = len(ws) / float(len(sents)), syl / float(len(ws))
    return {"words": len(ws), "sentences": len(sents), "words_per_sentence": round(wps, 1),
            "grade": round(max(0.0, 0.39 * wps + 11.8 * spw - 15.59), 1),
            "ease": round(206.835 - 1.015 * wps - 84.6 * spw, 1)}


def pronouns(text: str) -> dict:
    you = we = 0
    for tok in words_of(text):
        t = norm_apos(tok)
        if t.lower() in YOU_SET:
            you += 1
        elif t.lower() in WE_SET or t in ("us", "Us") or t in I_SET:
            we += 1
    return {"you": you, "we": we}


def is_titlecase_line(tokens: list) -> bool:
    if 2 <= len(tokens) <= 4 and all(t[0].isupper() for t in tokens):
        return True
    if len(tokens) < 3 or len(tokens) > 12:
        return False
    caps = sum(1 for t in tokens[1:] if t[0].isupper())
    return caps >= 0.6 * (len(tokens) - 1)


def specifics(text: str) -> dict:
    """Numbers, timeframes and named things. Heuristic: capitalised runs inside sentences count as names."""
    times = [(m.start(), m.end(), m.group(0)) for m in TIME_RE.finditer(text)]
    tmask = Claimed(len(text))
    for ts, te, _ in times:
        tmask.add(ts, te)
    nums = []
    for m in NUM_RE.finditer(text):
        if tmask.overlaps(m.start(), m.start() + 1):
            continue
        nums.append(m.group(0).strip())
    names = []
    for sent in split_sentences(text):
        toks = words_of(sent)
        if is_titlecase_line(toks):
            continue
        run, prev_end = [], 0
        matches = list(WORD_RE.finditer(sent))
        for i, m in enumerate(matches):
            t = m.group(0)
            joined = not sent[prev_end:m.start()].strip() or i == 0
            prev_end = m.end()
            capital = (t[0].isupper() or bool(re.search(r"[a-z][A-Z]", t))) and t not in CAP_STOP \
                and not t[0].isdigit() and t.lower().rstrip("s") not in DAYS
            if i == 0 and capital:
                nxt = matches[1].group(0) if len(matches) > 1 else ""
                capital = bool(nxt) and nxt[0].isupper() and nxt not in CAP_STOP and not sent[m.end():matches[1].start()].strip()
            if capital and (joined or not run):
                run.append(t)
            else:
                if run:
                    names.append(" ".join(run))
                run = [t] if capital else []
        if run:
            names.append(" ".join(run))
    return {"numbers": nums, "timeframes": [t for _, _, t in times], "names": names,
            "count": len(nums) + len(times) + len(names)}


def term_regex(form: str):
    esc = re.escape(form).replace("\\ ", r"\s+").replace("'", "['’]")
    return re.compile(r"(?<![\w-])" + esc + r"(?![\w-])", re.I)


def context(text: str, start: int, end: int, pad: int = 28) -> str:
    a, b = max(0, start - pad), min(len(text), end + pad)
    return ("..." if a else "") + flat(text[a:b].strip()) + ("..." if b < len(text) else "")


_RX_CACHE = {}


def find_terms(text: str, entries: list, used=None) -> list:
    """One combined pass, longest forms first. A span already claimed (by a longer match or an earlier call) is not counted twice."""
    if used is None:
        used = Claimed(len(text))
    fixes = {}
    for e in entries:
        for f in e["forms"]:
            fixes.setdefault(f, e.get("fix", ""))
    forms = tuple(sorted(fixes, key=lambda x: (-len(x), x)))
    if not forms:
        return []
    rx = _RX_CACHE.get(forms)
    if rx is None:
        alts = "|".join(re.escape(f).replace("\\ ", r"\s+").replace("'", "['\u2019]") for f in forms)
        rx = _RX_CACHE[forms] = re.compile(r"(?<![\w-])(?:" + alts + r")(?![\w-])", re.I)
    hits = {}
    for m in rx.finditer(text):
        if used.overlaps(m.start(), m.end()):
            continue
        used.add(m.start(), m.end())
        key = " ".join(m.group(0).lower().replace("\u2019", "'").split())
        h = hits.get(key)
        if h is None:
            h = hits[key] = {"term": key, "count": 0, "fix": fixes.get(key, ""), "example": context(text, m.start(), m.end())}
        h["count"] += 1
    return sorted(hits.values(), key=lambda h: (-h["count"], h["term"]))


def find_plain(text: str, forms: list, used=None) -> list:
    return find_terms(text, [{"forms": [f]} for f in forms], used)


def cta_candidates(raw: str) -> list:
    c = [m.group(1) for m in re.finditer(r"\[([^\]\n]{1,60})\]\(", raw)]
    for m in re.finditer(r"<(?:a|button)\b[^>]*>(.*?)</(?:a|button)>", raw, flags=re.S | re.I):
        c.append(re.sub(r"<[^>]+>", "", m.group(1)))
    for m in re.finditer(r"(?im)^\s*(?:primary |secondary )?(?:cta|button)\s*[:=\-]\s*(.+)$", raw):
        c.append(m.group(1))
    for line in strip_markup(raw).split("\n"):
        line = line.strip()
        if line and len(words_of(line)) <= 4 and not re.search(r"[.?!:]$", line):
            c.append(line)
    return c


def weak_cta_hits(raw: str, weak: list) -> list:
    forms = [(f, e.get("fix", "")) for e in weak for f in e["forms"]]
    single = {f for f, _ in forms if " " not in f}
    multi = [f for f, _ in forms if " " in f]
    fixes = dict(forms)
    hits = {}
    for cand in cta_candidates(raw):
        n = " ".join(re.sub(r"[^\w\s']", " ", norm_apos(cand).lower()).split())
        if not n:
            continue
        key = n if (n in single or n in multi) else None
        if key is None:
            for f in multi:
                if n.startswith(f + " ") and len(n.split()) <= 3:
                    key = f
                    break
        if key:
            h = hits.setdefault(n, {"text": cand.strip(), "matches": key, "count": 0, "fix": fixes.get(key, "")})
            h["count"] += 1
    return sorted(hits.values(), key=lambda h: (-h["count"], h["text"]))


# --------------------------------------------------------------------------- score: metrics

AI_CONTRAST = [
    re.compile(r"\b(?:it|this|that)(?:['’]s|\s+is)\s+not\b[^.!?\n]{1,70}[.;,]\s*(?:it|this|that)(?:['’]s|\s+is)\b", re.I),
    re.compile(r"\b(?:isn['’]t|aren['’]t|not)\s+(?:just|only|merely|simply)\b[^.!?\n]{1,70}\b(?:but|it['’]s)\b", re.I),
]
TRIAD_RE = re.compile(r"\b[A-Za-z]+,\s+[A-Za-z]+,?\s+(?:and|&)\s+[A-Za-z]+\b")


def staccato_runs(sents: list) -> int:
    runs = cur = 0
    for s in sents:
        if s.endswith(".") and 1 <= len(words_of(s)) <= 3:
            cur += 1
            if cur == 3:
                runs += 1
        else:
            cur = 0
    return runs


def heading_lines(raw: str) -> list:
    """First line, markdown headings, and standalone short questions outside an FAQ section."""
    out, first, in_faq = [], True, False
    for line in raw.split("\n"):
        t = line.strip()
        if not t:
            continue
        if first or t.startswith("#"):
            txt = t.lstrip("#").strip(" *_`")
            out.append(txt)
            if t.startswith("#"):
                in_faq = bool(re.search(r"faq|question", txt, re.I))
        elif not in_faq and t.endswith("?") and len(words_of(t)) <= 10 and not re.search(r"[.!]\s", t):
            out.append(t.strip(" *_`"))
        first = False
    return out


def cap_items(items: list, n: int = 6) -> list:
    return items[:n] + (["+%d more" % (len(items) - n)] if len(items) > n else [])


def score_text(raw: str, kill: dict) -> dict:
    clean = strip_markup(raw)
    ws = words_of(clean)
    n = len(ws)
    if n == 0:
        raise UsageError("no text to score")
    sents = split_sentences(clean)
    short = n < 40
    metrics = []

    def add(mid, label, value, flag, detail, items=None):
        if short and flag == "fix" and mid in ("you_we", "reading", "specificity", "rhythm"):
            flag = "check"
        metrics.append({"id": mid, "label": label, "value": value, "flag": flag, "detail": detail, "items": items or []})

    pr = pronouns(clean)
    tot = pr["you"] + pr["we"]
    if tot == 0:
        add("you_we", "you vs we", "no direct address", "check" if not short else "ok",
            "Nothing says 'you' or 'we'. Copy addressed to the reader ('you', 'your') is easier to act on.")
    else:
        share = pr["you"] / float(tot)
        fl = "fix" if share < 0.4 else ("check" if share < 0.6 else "ok")
        add("you_we", "you vs we", "you %d : we %d (%s you)" % (pr["you"], pr["we"], pct(share, 0)), fl,
            "Aim for at least 60% of pronouns pointing at the reader. Copy that talks about 'we' sells the company, not the outcome.")
    rd = reading(clean)
    if n < 25 or rd["grade"] is None:
        add("reading", "reading grade", "n/a (under 25 words)", "n/a", "Too short to grade reliably.")
    else:
        g = rd["grade"]
        add("reading", "reading grade", "grade %.1f (ease %.0f, %.1f words per sentence)" % (g, rd["ease"], rd["words_per_sentence"]),
            "ok" if g <= 9 else ("check" if g <= 12 else "fix"),
            "Flesch-Kincaid estimate. Consumer copy reads best at grade 6 to 9; technical B2B can run to 11. A heuristic, not a verdict.")
    sp = specifics(clean)
    per = sp["count"] * 100.0 / n
    parts = "%d number%s, %d timeframe%s, %d named" % (len(sp["numbers"]), "" if len(sp["numbers"]) == 1 else "s",
                                                         len(sp["timeframes"]), "" if len(sp["timeframes"]) == 1 else "s", len(sp["names"]))
    add("specificity", "specificity", "%.1f per 100 words (%s)" % (per, parts),
        "ok" if per >= 4 else ("check" if per >= 2 else "fix"),
        "Numbers, timeframes and named things. Under 2 per 100 words reads as filler; go get the missing facts, do not invent them.",
        cap_items(["numbers: " + ", ".join(sp["numbers"][:6]) if sp["numbers"] else "numbers: none",
                   "timeframes: " + ", ".join(sp["timeframes"][:6]) if sp["timeframes"] else "timeframes: none",
                   "named: " + ", ".join(sp["names"][:6]) if sp["names"] else "named: none"]))
    used = Claimed(len(clean))
    kh = find_terms(clean, kill["words"] + kill["phrases"], used)
    kt = sum(h["count"] for h in kh)
    add("kill_list", "kill-list hits", "%d hit%s" % (kt, "" if kt == 1 else "s"), "ok" if kt == 0 else ("check" if kt <= 2 else "fix"),
        "Marketing-speak that says nothing. The fix is the named thing, never a synonym.",
        cap_items(["%s x%d: %s [%s]" % (h["term"], h["count"], h["fix"], h["example"]) for h in kh]))
    fh = find_plain(clean, kill["intensifiers"])
    ft = sum(h["count"] for h in fh)
    fper = ft * 100.0 / n
    add("filler", "filler words", "%d (%.1f per 100 words)" % (ft, fper), "check" if (fper >= 2.5 and not short) else "ok",
        "very, really, just, actually and friends. Cut them; the claim carries the confidence.",
        cap_items(["%s x%d" % (h["term"], h["count"]) for h in fh]))
    ex = clean.count("!")
    add("exclamation", "exclamation marks", str(ex), "ok" if ex == 0 else ("check" if ex <= 2 else "fix"),
        "Confidence lives in the claim, not the punctuation.")
    masked = re.sub(r"best practices?", lambda m: " " * len(m.group(0)), clean, flags=re.I)
    sh = find_plain(masked, kill["unproven_superlatives"])
    st = sum(h["count"] for h in sh)
    add("superlatives", "superlatives to prove", str(st), "ok" if st == 0 else ("check" if st <= 2 else "fix"),
        "Each needs a source, a date and a number next to it, or it goes.",
        cap_items(["%s x%d [%s]" % (h["term"], h["count"], h["example"]) for h in sh]))
    qh = [h for h in heading_lines(raw) if h.endswith("?") and len(words_of(h)) <= 14]
    add("question_headings", "question headlines", str(len(qh)), "ok" if not qh else "check",
        "A question invites 'no'. Use one only when nearly everyone arriving would say yes. FAQ questions are not counted.",
        cap_items(qh))
    wc = weak_cta_hits(raw, kill["weak_ctas"])
    add("weak_ctas", "weak CTA defaults", str(len(wc)), "ok" if not wc else "fix",
        "Submit, Learn More, Click Here, Get Started name the reader's effort, not the value. Use verb plus the thing they get.",
        cap_items(['"%s" -> %s' % (h["text"], h["fix"]) for h in wc]))
    lens = [len(words_of(s)) for s in sents if words_of(s)]
    if len(lens) < 5:
        add("rhythm", "sentence-length spread", "n/a (under 5 sentences)", "n/a", "Too few sentences to judge rhythm.")
    else:
        sd = statistics.pstdev(lens)
        longs = sum(1 for x in lens if x > 30)
        fl = "fix" if longs >= 3 else ("check" if (longs or sd < 4) else "ok")
        add("rhythm", "sentence-length spread", "mean %.1f, stdev %.1f, shortest %d, longest %d, %d over 30 words"
            % (statistics.mean(lens), sd, min(lens), max(lens), longs), fl,
            "A stdev under 4 reads monotone. Mix short punches with longer sentences; split anything over 30 words.")
    ai = []
    for rx in AI_CONTRAST:
        for m in rx.finditer(clean):
            ai.append("contrast frame: " + context(clean, m.start(), m.end(), 0))
    for h in find_plain(clean, kill["ai_tell_phrases"], used):
        ai.append("stock phrase: %s x%d" % (h["term"], h["count"]))
    sr = staccato_runs(sents)
    if sr:
        ai.append("staccato run of 3+ fragments x%d" % sr)
    tri = len(TRIAD_RE.findall(clean))
    if tri >= 3:
        ai.append("parallel one-word triads x%d" % tri)
    add("ai_tells", "AI-tell patterns", str(len(ai)), "ok" if not ai else ("check" if len(ai) <= 2 else "fix"),
        "Scaffolding readers pattern-match as machine copy: 'It's not X. It's Y.', stacked triads, staccato fragments.", cap_items(ai))
    dash = clean.count(EM) + len(re.findall(r"\s" + EN + r"\s", clean))
    dper = dash * 100.0 / n
    add("dashes", "em dashes", "%d (%.1f per 100 words)" % (dash, dper),
        "fix" if (dash >= 5 and dper >= 1.5) else ("check" if (dash >= 2 and dper >= 0.7) else "ok"),
        "Heavy dash use is a common machine-writing tell. Swap most for a period or a comma.")
    return {"words": n, "sentences": len(sents), "short_text": short, "metrics": metrics,
            "fix": sum(1 for m in metrics if m["flag"] == "fix"), "check": sum(1 for m in metrics if m["flag"] == "check")}


# --------------------------------------------------------------------------- headline ranking

def parse_headlines(raw: str) -> list:
    out = []
    for line in raw.split("\n"):
        t = re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", line).strip().lstrip("#").strip()
        t = t.strip("*_`").strip().strip("\"“”").strip()
        if t:
            out.append(t)
    return out


def rank_headlines(lines: list, kill: dict) -> list:
    ranked = []
    for idx, h in enumerate(lines):
        n = len(words_of(h))
        parts = []

        def part(factor, pts, why):
            parts.append({"factor": factor, "points": pts, "why": why})

        if 5 <= n <= 12:
            part("length", 2, "%d words, in the 5 to 12 sweet spot" % n)
        elif 3 <= n <= 16:
            part("length", 1, "%d words, workable but %s" % (n, "thin" if n < 5 else "long"))
        else:
            part("length", 0, "%d words, %s" % (n, "too thin to carry a claim" if n < 3 else "too long to skim"))
        sp = specifics(h)
        bits = sp["numbers"] + sp["timeframes"] + sp["names"]
        part("specificity", min(3, sp["count"]), ("found " + ", ".join(bits[:4])) if bits else "no number, timeframe or named thing")
        low = h.lower()
        sig = sorted({s for s in kill["benefit_signals"] if term_regex(s).search(low)})
        part("benefit", min(2, len(sig)), ("outcome words: " + ", ".join(sig[:4])) if sig else "no outcome signal")
        pr = pronouns(h)
        if pr["you"]:
            part("you-focus", 1, "speaks to the reader")
        elif pr["we"]:
            part("you-focus", -1, "about us, not the reader")
        else:
            part("you-focus", 0, "no pronoun (fine for a plain claim)")
        kh = find_terms(h, kill["words"] + kill["phrases"])
        if kh:
            part("kill-list", -min(4, 2 * len(kh)), "uses " + ", ".join(x["term"] for x in kh))
        if "!" in h:
            part("punctuation", -1, "exclamation mark")
        sh = find_plain(h, kill["unproven_superlatives"])
        if sh:
            part("superlative", -1, "unproven: " + ", ".join(x["term"] for x in sh))
        if h.endswith("?"):
            part("question", -1, "a question invites 'no'")
        total = sum(p["points"] for p in parts)
        ranked.append({"text": h, "points": total, "words": n, "chars": len(h), "parts": parts, "_i": idx})
    ranked.sort(key=lambda r: (-r["points"], r["_i"]))
    for i, r in enumerate(ranked, 1):
        r["rank"] = i
        del r["_i"]
    return ranked


def render_score(res, ranked) -> str:
    tag = {"ok": "OK   ", "check": "CHECK", "fix": "FIX  ", "n/a": "n/a  "}
    out = []
    if res:
        out.append("COPY METRICS (plain flags, no single grade)  words %d, sentences %d%s"
                   % (res["words"], res["sentences"], "  [short text: ratio metrics are noisy]" if res["short_text"] else ""))
        for m in res["metrics"]:
            out.append("[%s] %s: %s" % (tag[m["flag"]], m["label"], m["value"]))
            if m["flag"] not in ("ok", "n/a") or m["items"]:
                out.append("        " + m["detail"])
            for it in m["items"]:
                out.append("        - " + it)
        out.append("\n%d to fix, %d to check. Flags are heuristics: they point at lines to read, not at a score to chase."
                   % (res["fix"], res["check"]))
    if ranked:
        out.append(("\n" if res else "") + "HEADLINE RANKING (triage on length, specificity, outcome words, you-focus and banned words; not a conversion prediction)")
        for r in ranked:
            out.append("%2d. [%+d] %s" % (r["rank"], r["points"], r["text"]))
            out.append("        " + " | ".join("%s %+d (%s)" % (p["factor"], p["points"], p["why"]) for p in r["parts"]))
    return "\n".join(out)


def cmd_score(a) -> int:
    kill = load_json("kill-list.json")
    if not a.file and not a.headlines:
        raise UsageError("give a FILE to score, or --headlines FILE, or both")
    res = None
    if a.file:
        res = score_text(read_arg(a.file, literal_ok=False), kill)
    ranked = None
    if a.headlines:
        hl = parse_headlines(read_arg(a.headlines, literal_ok=False))
        if not hl:
            raise UsageError("no headline candidates found in %s" % a.headlines)
        ranked = rank_headlines(hl, kill)
    if a.json:
        emit_json({"score": res, "headlines": ranked})
    else:
        print(render_score(res, ranked))
    return 1 if (res and res["fix"]) else 0


# --------------------------------------------------------------------------- abtest

def parse_rate(text: str, name: str) -> float:
    t = text.strip()
    try:
        v = float(t.rstrip("%").strip().replace(",", "."))
    except ValueError:
        raise UsageError("%s must be a number like 3.2%% (got '%s')" % (name, text))
    if t.endswith("%") or v > 1:
        v = v / 100.0
    return v


def sample_size(p1: float, p2: float, alpha: float, power: float, two_sided: bool = True) -> int:
    nd = statistics.NormalDist()
    za = nd.inv_cdf(1 - alpha / 2.0) if two_sided else nd.inv_cdf(1 - alpha)
    zb = nd.inv_cdf(power)
    pbar = (p1 + p2) / 2.0
    num = (za * math.sqrt(2 * pbar * (1 - pbar)) + zb * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
    return int(math.ceil(num / ((p2 - p1) ** 2)))


def min_detectable_lift(p1: float, per_variant: float, alpha: float, power: float, two_sided: bool):
    """Smallest relative lift detectable with per_variant visitors, or None."""
    hi = min(20.0, (0.999 / p1) - 1.0)
    if hi <= 0 or sample_size(p1, p1 * (1 + hi), alpha, power, two_sided) > per_variant:
        return None
    lo = 1e-4
    for _ in range(60):
        mid = (lo + hi) / 2.0
        if sample_size(p1, p1 * (1 + mid), alpha, power, two_sided) <= per_variant:
            hi = mid
        else:
            lo = mid
    return hi


def abtest(baseline: float, lift: float, vpw: float, variants: int, alpha: float, power: float,
           two_sided: bool, absolute: bool, max_weeks: float) -> dict:
    if not 0 < baseline < 1:
        raise UsageError("--baseline must be between 0%% and 100%% (got %s)" % pct(baseline, 2))
    if lift <= 0:
        raise UsageError("--lift must be positive")
    p2 = baseline + lift if absolute else baseline * (1 + lift)
    if not 0 < p2 < 1:
        raise UsageError("baseline plus lift gives %s, which is not a possible rate" % pct(p2, 2))
    if vpw <= 0:
        raise UsageError("--visitors-per-week must be positive")
    if variants < 2:
        raise UsageError("--variants counts the control too, so it must be at least 2")
    if not (0 < alpha < 0.5 and 0.5 <= power < 1):
        raise UsageError("use --alpha between 0 and 0.5 (usually 0.05) and --power between 0.5 and 1 (usually 0.8)")
    comparisons = variants - 1
    a_eff = alpha / comparisons
    n = sample_size(baseline, p2, a_eff, power, two_sided)
    total = n * variants
    weeks = total / float(vpw)
    per_week_variant = vpw / float(variants)
    res = {"baseline": baseline, "target": p2, "relative_lift": (p2 / baseline) - 1, "alpha": alpha, "alpha_per_comparison": a_eff,
           "power": power, "two_sided": two_sided, "variants": variants, "visitors_per_variant": n, "visitors_total": total,
           "visitors_per_week": vpw, "weeks_needed": round(weeks, 1), "control_conversions_expected": int(round(n * baseline)),
           "max_weeks": max_weeks}
    if weeks <= 4:
        res["verdict"] = "testable"
        res["advice"] = ("Run it for %d full weeks so every weekday appears equally, fix the sample size before you start, "
                         "and do not stop early because the numbers look good." % max(2, int(math.ceil(weeks))))
    elif weeks <= max_weeks:
        res["verdict"] = "slow"
        res["advice"] = ("Possible but slow (%d weeks). Consider a bolder change (bigger real lift needs fewer visitors), "
                         "a higher-traffic page, or a metric earlier in the funnel. Fix the end date before you start."
                         % int(math.ceil(weeks)))
    else:
        mde = min_detectable_lift(baseline, per_week_variant * max_weeks, a_eff, power, two_sided)
        res["verdict"] = "not testable"
        res["min_detectable_lift_in_max_weeks"] = None if mde is None else round(mde, 3)
        need = int(math.ceil(total / float(max_weeks)))
        res["visitors_per_week_needed"] = need
        res["advice"] = ("Not testable at this traffic. Ship the best judgment: pick the version that wins the message check and "
                         "the skim test, then compare the before and after periods and watch for a large change. "
                         "To run a real test you would need about %s visitors a week for %d weeks%s."
                         % (format(need, ","), int(max_weeks),
                            "" if mde is None else ", or accept detecting only a relative lift of %s or more in that time" % pct(mde, 0)))
    if res["control_conversions_expected"] < 100:
        res["caution"] = "Fewer than 100 expected conversions in the control: the normal approximation is rough at this size."
    return res


def render_abtest(r: dict) -> str:
    out = ["A/B TEST SIZING",
           "  baseline %s -> target %s (%+.1f%% relative), %s alpha %.2f%s, power %d%%, %d variants incl. control"
           % (pct(r["baseline"], 2), pct(r["target"], 2), r["relative_lift"] * 100, "two-sided" if r["two_sided"] else "one-sided",
              r["alpha"], "" if r["variants"] == 2 else " (Bonferroni: %.3f per comparison)" % r["alpha_per_comparison"],
              round(r["power"] * 100), r["variants"]),
           "  needed : %s visitors per variant, %s in total (about %s conversions in the control arm)"
           % (format(r["visitors_per_variant"], ","), format(r["visitors_total"], ","), format(r["control_conversions_expected"], ",")),
           "  traffic: %s visitors a week -> %.1f weeks" % (format(int(r["visitors_per_week"]), ","), r["weeks_needed"]),
           "  verdict: " + r["verdict"].upper(),
           "  " + r["advice"]]
    if r.get("caution"):
        out.append("  caution: " + r["caution"])
    out.append("  This sizes a test. It is not a forecast: most copy changes move conversion less than the lift you plug in.")
    return "\n".join(out)


def cmd_abtest(a) -> int:
    base = parse_rate(a.baseline, "--baseline")
    lift = parse_rate(a.lift, "--lift")
    r = abtest(base, lift, a.visitors_per_week, a.variants, a.alpha, a.power, not a.one_sided, a.absolute, a.max_weeks)
    if a.json:
        emit_json(r)
    else:
        print(render_abtest(r))
    return 0


# --------------------------------------------------------------------------- cli

def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="copy_check.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    f = sub.add_parser("fit", help="check text against a platform limit and preview the cut")
    f.add_argument("platform", help="for example google-ads, meta-ads, linkedin, x, email, seo, sms")
    f.add_argument("field", help="for example rsa-headline, post, subject-mobile, title (see the specs command)")
    f.add_argument("text", help="the text itself, a file path, or - for stdin")
    f.add_argument("--lines", action="store_true", help="treat each non-empty line as a separate item")
    f.add_argument("--strict", action="store_true", help="exit 1 when text is cut by the reader's view, not only when over the hard limit")
    f.add_argument("--json", action="store_true")
    f.set_defaults(fn=cmd_fit)
    sp = sub.add_parser("specs", help="list platforms and fields, or one platform's fields")
    sp.add_argument("platform", nargs="?")
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(fn=cmd_specs)
    sc = sub.add_parser("score", help="plain metrics and flags for a piece of copy")
    sc.add_argument("file", nargs="?", help="copy to score (.txt or .md), or - for stdin")
    sc.add_argument("--headlines", metavar="FILE", help="headline candidates, one per line, to rank")
    sc.add_argument("--json", action="store_true")
    sc.set_defaults(fn=cmd_score)
    ab = sub.add_parser("abtest", help="sample size, weeks needed and an honest verdict")
    ab.add_argument("--baseline", required=True, help="current conversion rate, for example 3.2%%")
    ab.add_argument("--lift", required=True, help="relative lift you hope to detect, for example 20%%")
    ab.add_argument("--visitors-per-week", type=float, required=True, help="total visitors to the page each week")
    ab.add_argument("--variants", type=int, default=2, help="including the control (default 2)")
    ab.add_argument("--alpha", type=float, default=0.05)
    ab.add_argument("--power", type=float, default=0.8)
    ab.add_argument("--one-sided", action="store_true")
    ab.add_argument("--absolute", action="store_true", help="read --lift as percentage points instead of relative")
    ab.add_argument("--max-weeks", type=float, default=8, help="longest test you would accept (default 8)")
    ab.add_argument("--json", action="store_true")
    ab.set_defaults(fn=cmd_abtest)
    return ap


def main(argv=None) -> int:
    ap = build_parser()
    a = ap.parse_args(argv)
    if not getattr(a, "fn", None):
        ap.print_help()
        return 2
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        return a.fn(a)
    except UsageError as ex:
        sys.stderr.write("copy_check: %s\n" % ex)
        return 2
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    sys.exit(main())
