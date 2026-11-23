#!/usr/bin/env python3
"""Humanizer toolkit: measure the AI accent in a text, guard its facts through a rewrite, match a person's voice.

Subcommands
  scan FILE|-                         accent score 0-100, hit list with fix hints, rhythm stats
  compare BEFORE AFTER                score change plus FACT GUARD (numbers, names, links kept? anything invented?)
  fingerprint SAMPLES... [--out F]    measure how a person writes (measurements only, no sentences stored)
  match DRAFT --voice voice.json      concrete deltas between a draft and that voice
  example [--register R]              verified before/after pairs for a register

Examples
  python3 scripts/tells.py scan draft.txt
  python3 scripts/tells.py compare before.txt after.txt
  python3 scripts/tells.py fingerprint mail1.txt mail2.txt --out voice.json
  python3 scripts/tells.py match after.txt --voice voice.json
  python3 scripts/tells.py example --register email

The score counts style tells. It is NOT an AI detector: it says nothing about how any detector will rate a text.
Exit codes: 0 ok, 1 findings (fact errors in compare, --fail-above in scan, --strict in match), 2 usage error.
Use `-` as a file name to read stdin. Standard library only; no network.
"""
from __future__ import annotations

import argparse
import bisect
import json
import math
import re
import sys
import unicodedata
from array import array
from collections import Counter
from pathlib import Path

VERSION = "2.0.0"
SKILL_DIR = Path(__file__).resolve().parent.parent
ASSETS = SKILL_DIR / "assets"


class UserError(Exception):
    """A mistake by the user: print one line, exit 2."""


# --------------------------------------------------------------------------- text plumbing

_CHARMAP = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'", "\u2032": "'",
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u00ab": '"', "\u00bb": '"',
    "\u00a0": " ", "\u2007": " ", "\u202f": " ", "\u2009": " ", "\u200a": " ", "\u200b": " ", "\ufeff": " ",
})
WORD_RE = re.compile(r"\d+(?:[.,]\d+)+(?![^\W_])|[^\W_]+(?:['\-][^\W_]+)*")
_FENCE_RE = re.compile(r"```.*?(?:```|\Z)|~~~.*?(?:~~~|\Z)", re.S)
_ICODE_RE = re.compile(r"`[^`\n]+`")
_URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\[\]()\"']+", re.I)
_LOCAL_OK = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._%+-")
_EMAIL_DOMAIN_RE = re.compile(r"[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,6}\.[A-Za-z]{2,24}")
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+\S")
_BULLET_RE = re.compile(r"^\s*(?:[-*+\u2022\u25cf\u25aa\u2013]|\d{1,3}[.)])\s+\S")
_QUOTE_LINE_RE = re.compile(r"^\s*>")
_TERM_RE = re.compile(r"[.!?\u2026]+[\"')\]]*(?=\s|$)")
_PARA_RE = re.compile(r"\n[ \t]*\n\s*")
_ABBR = {"mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "inc", "ltd", "approx", "dept", "cf", "al", "e.g", "i.e", "u.s", "u.k"}
_SENT_OPEN = set(" \t\"'([*_#>-\u2022")
_CONTRACTED_RE = re.compile(r"\b\w+n't\b|\b(?:i|you|we|they|he|she|it|that|there|what|who|let|here)'(?:m|re|ve|ll|d|s)\b")
_EXPANDED_RE = re.compile(
    r"\b(?:do|does|did|is|are|was|were|have|has|had|would|should|could|will|must|need)\s+not\b|\bcannot\b"
    r"|\b(?:it|that|there|he|she|we|you|they|who|what)\s+(?:is|are|will|would)\b|\bi\s+(?:am|will|would)\b|\blet\s+us\b")


def read_source(path):
    if path == "-":
        data = sys.stdin.buffer.read()
    else:
        p = Path(path)
        if p.is_dir():
            raise UserError("'%s' is a directory; give a text file, or - for stdin" % path)
        try:
            data = p.read_bytes()
        except OSError as ex:
            raise UserError("cannot read '%s': %s" % (path, ex.strerror or ex))
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = data.decode("utf-16", errors="replace")
    else:
        text = data.decode("utf-8-sig", errors="replace")
    return text.replace("\r\n", "\n").replace("\r", "\n")


def safe_lower(s):
    low = s.lower()
    if len(low) == len(s):
        return low
    return "".join(c.lower() if len(c.lower()) == 1 else c for c in s)


def email_spans(t):
    """Spans of e-mail addresses. Anchored on '@' so long runs of letters cannot make it quadratic."""
    out = []
    i = t.find("@")
    while i != -1:
        j = i
        while j > 0 and i - j < 64 and t[j - 1] in _LOCAL_OK:
            j -= 1
        if j < i:
            m = _EMAIL_DOMAIN_RE.match(t, i + 1)
            if m:
                out.append((j, m.end()))
                i = t.find("@", m.end())
                continue
        i = t.find("@", i + 1)
    return out


def _blank(m):
    return re.sub(r"[^\n]", " ", m.group(0))


def _xs(m):
    s = m.group(0)
    core = s.rstrip(".,;:!?")
    return "x" * len(core) + s[len(core):]


def mask_text(t):
    """Same-length copy without code, links and markdown stars, so offsets stay valid."""
    t = _FENCE_RE.sub(_blank, t)
    t = _ICODE_RE.sub(_blank, t)
    t = _URL_RE.sub(_xs, t)
    spans = email_spans(t)
    if spans:
        parts, last = [], 0
        for a, b in spans:
            parts.append(t[last:a])
            parts.append("x" * (b - a))
            last = b
        parts.append(t[last:])
        t = "".join(parts)
    return t.replace("*", " ")


def _opener_char(ch):
    if ch in _SENT_OPEN:
        return True
    return ord(ch) > 127 and unicodedata.category(ch) in ("So", "Sk", "Sm", "Mn", "Cf")


def at_sentence_start(text, pos):
    i = pos - 1
    while i >= 0 and _opener_char(text[i]):
        i -= 1
    if i < 0:
        return True
    if text[i] == ".":
        j = i
        while j > 0 and text[j - 1].isalpha():
            j -= 1
        word = text[j:i]
        if word.lower() in _ABBR and (len(word) > 1 or not word.isupper()):
            return False
    return text[i] in ".!?\n\u2026"


def split_sentences(seg, base):
    """Sentence spans (absolute offsets) inside one prose block."""
    out = []
    start = 0
    n = len(seg)
    for m in _TERM_RE.finditer(seg):
        end = m.end()
        j = end
        while j < n and seg[j].isspace():
            j += 1
        first = m.group(0)[0]
        if first == "." and j < n and not (seg[j].isupper() or seg[j].isdigit() or seg[j] in "\"'(["):
            continue
        if first == "." and len(m.group(0)) == 1:
            k = m.start()
            i = k
            while i > start and (seg[i - 1].isalpha() or seg[i - 1] == "."):
                i -= 1
            tok = seg[i:k]
            if tok.lower().rstrip(".") in _ABBR or (len(tok) == 1 and tok.isupper()):
                continue
        out.append((base + start, base + end))
        start = j
    if start < n and seg[start:].strip():
        out.append((base + start, base + n))
    return out


class Doc:
    """One text, prepared once: normalized, masked, lowercased, tokenized, split into blocks and sentences."""

    def __init__(self, text):
        self.raw = text.translate(_CHARMAP)
        self.masked = mask_text(self.raw)
        self.low = safe_lower(self.masked)
        self.starts = array("l", (m.start() for m in WORD_RE.finditer(self.masked)))
        self.n_words = len(self.starts)
        self.line_starts = [0] + [m.end() for m in re.finditer("\n", self.raw)]
        self.para_starts = [0] + [m.end() for m in _PARA_RE.finditer(self.raw)]
        self._blocks = None
        self._prose = None

    def line_of(self, pos):
        return bisect.bisect_right(self.line_starts, pos)

    def col_of(self, pos):
        return pos - self.line_starts[self.line_of(pos) - 1] + 1

    def count_words(self, a, b):
        return bisect.bisect_left(self.starts, b) - bisect.bisect_left(self.starts, a)

    def first_word(self, a):
        i = bisect.bisect_left(self.starts, a)
        if i >= len(self.starts):
            return ""
        m = WORD_RE.match(self.low, self.starts[i])
        return m.group(0) if m else ""

    def blocks(self):
        if self._blocks is None:
            out = []
            raw, masked, ls = self.raw, self.masked, self.line_starts
            cur = None
            prev_kind = None
            for i, s in enumerate(ls):
                e = ls[i + 1] - 1 if i + 1 < len(ls) else len(raw)
                seg = masked[s:e]
                if not seg.strip():
                    if cur:
                        out.append(("prose", cur[0], cur[1]))
                        cur = None
                    prev_kind = None
                    continue
                line = raw[s:e]
                if _HEADING_RE.match(line):
                    kind = "heading"
                elif _BULLET_RE.match(line):
                    kind = "bullet"
                elif _QUOTE_LINE_RE.match(line):
                    kind = "quote"
                elif prev_kind == "bullet" and line[:2] == "  ":
                    kind = "bullet-cont"
                else:
                    kind = "prose"
                if kind == "prose":
                    if cur is None:
                        cur = [s + (len(line) - len(line.lstrip())), e]
                    else:
                        cur[1] = e
                else:
                    if cur:
                        out.append(("prose", cur[0], cur[1]))
                        cur = None
                    if kind != "bullet-cont":
                        out.append((kind, s, e))
                prev_kind = "bullet" if kind in ("bullet", "bullet-cont") else kind
            if cur:
                out.append(("prose", cur[0], cur[1]))
            self._blocks = out
        return self._blocks

    def prose(self):
        """(sentences, paragraphs) from prose blocks only. Greetings and sign-offs are skipped."""
        if self._prose is None:
            sents, paras = [], []
            for kind, s, e in self.blocks():
                if kind != "prose":
                    continue
                seg = self.masked[s:e]
                nw = self.count_words(s, e)
                if nw <= 4 and not re.search(r"[.!?\u2026][\"')\]]*\s*$", seg):
                    continue
                cnt = 0
                for a, b in split_sentences(seg, s):
                    n = self.count_words(a, b)
                    if n:
                        sents.append((a, b, n, self.first_word(a)))
                        cnt += 1
                paras.append((s, e, nw, cnt))
            self._prose = (sents, paras)
        return self._prose


# --------------------------------------------------------------------------- lexicon

class Hit:
    __slots__ = ("cat", "label", "start", "end", "sev", "ent")

    def __init__(self, cat, label, start, end, sev, ent):
        self.cat, self.label, self.start, self.end, self.sev, self.ent = cat, label, start, end, sev, ent


class Lexicon:
    def __init__(self, data):
        self.data = data
        sc = data["scoring"]
        self.sev_points = {int(k): float(v) for k, v in sc["sev_points"].items()}
        self.mult = sc["category_mult"]
        self.floor_words = int(sc["floor_words"])
        self.scale = float(sc["scale"])
        self.bands = [(n, int(m)) for n, m in sc["bands"]]
        self.rhythm = data["rhythm"]
        self.word_map = {}
        for e in data["words"]:
            e["_skip"] = re.compile(e["skip"]) if e.get("skip") else None
            for f in e["w"]:
                self.word_map[f] = e
        self.anchors = {}
        self.free_res = []
        for cat in ("phrases", "openers_closers"):
            for e in data[cat]:
                if "p" in e:
                    for v in e["p"]:
                        first = WORD_RE.match(v).group(0)
                        pat = r"\s+".join(re.escape(t) for t in v.split()) + (r"(?!\w)" if v[-1].isalnum() else "")
                        self.anchors.setdefault(first, []).append((e, cat, re.compile(pat)))
                else:
                    self.free_res.append((e, cat, re.compile(e["re"])))
        self.structs = [(e, re.compile(e["re"], re.M)) for e in data["structures"]]
        self.punct = [(e, re.compile(e["re"])) for e in data["punctuation"]]

    def band(self, score):
        for name, top in self.bands:
            if score <= top:
                return name
        return self.bands[-1][0]


_LEX = None


def load_lexicon():
    global _LEX
    if _LEX is None:
        p = ASSETS / "tells.json"
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            _LEX = Lexicon(data)
        except (OSError, ValueError, KeyError, re.error) as ex:
            raise UserError("cannot load lexicon %s: %s" % (p, ex))
    return _LEX


_PRI = {"openers_closers": 3, "phrases": 2, "words": 1, "structures": 1}


def _resolve(hits):
    hits.sort(key=lambda h: (h.start, -(h.end - h.start)))
    out = []
    for h in hits:
        if out and h.start < out[-1].end:
            prev = out[-1]
            if (_PRI[h.cat], h.sev, h.end - h.start) > (_PRI[prev.cat], prev.sev, prev.end - prev.start):
                out[-1] = h
            continue
        out.append(h)
    return out


def _word_ok(ent, doc, s, e):
    if ent.get("initial") and not at_sentence_start(doc.masked, s):
        return False
    if ent.get("comma") and not re.match(r"\s*,", doc.low[e:e + 8]):
        return False
    sk = ent["_skip"]
    if sk is not None and sk.search(doc.low, max(0, s - 40), e + 40):
        return False
    return True


def _phrase_ok(ent, doc, s, e):
    if ent.get("initial") and not at_sentence_start(doc.masked, s):
        return False
    where = ent.get("where")
    if where == "start":
        i = bisect.bisect_right(doc.para_starts, s) - 1
        return s - doc.para_starts[i] <= 90
    if where == "end":
        return e >= len(doc.raw.rstrip()) - 300
    return True


def find_hits(doc, lex):
    masked, low, raw = doc.masked, doc.low, doc.raw
    tier = []
    for m in WORD_RE.finditer(low):
        s, e = m.span()
        tok = m.group(0)
        ent = lex.word_map.get(tok)
        if ent is not None and _word_ok(ent, doc, s, e):
            tier.append(Hit("words", tok, s, e, ent["sev"], ent))
        lst = lex.anchors.get(tok)
        if lst:
            for ent, cat, rx in lst:
                mm = rx.match(low, s)
                if mm and _phrase_ok(ent, doc, mm.start(), mm.end()):
                    tier.append(Hit(cat, " ".join(mm.group(0).split()), mm.start(), mm.end(), ent["sev"], ent))
    for ent, cat, rx in lex.free_res:
        for mm in rx.finditer(low):
            if _phrase_ok(ent, doc, mm.start(), mm.end()):
                tier.append(Hit(cat, " ".join(mm.group(0).split()), mm.start(), mm.end(), ent["sev"], ent))
    hits = _resolve(tier)
    st = []
    for ent, rx in lex.structs:
        if ent.get("max_words") and doc.n_words > ent["max_words"]:
            continue
        src = raw if ent.get("raw") else (masked if ent.get("cs") else low)
        found = []
        for mm in rx.finditer(src):
            span = mm.span("hit") if "hit" in rx.groupindex and mm.group("hit") is not None else mm.span()
            found.append(span)
        if len(found) < ent.get("min", 1):
            continue
        for s, e in found[ent.get("free", 0):]:
            st.append(Hit("structures", ent.get("label") or ent["id"].replace("_", " "), s, e, ent["sev"], ent))
    hits += _resolve(st)
    return hits


# --------------------------------------------------------------------------- analysis and score

CONTRIB_LABELS = {
    "words": "stock words", "phrases": "stock phrases", "openers_closers": "canned openers and closers",
    "structures": "formulaic structures", "em_dash": "em dashes", "punctuation": "other punctuation habits",
    "rhythm": "rhythm and register",
}


def _r2(x):
    return round(float(x), 2)


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def _stdev(xs):
    if len(xs) < 2:
        return 0.0
    m = _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))


def _top_labels(counter, k=3):
    items = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[:k]
    return ", ".join(l if c == 1 else "%s x%d" % (l, c) for l, c in items)


def contraction_counts(low):
    return len(_CONTRACTED_RE.findall(low)), len(_EXPANDED_RE.findall(low))


def rhythm_measures(doc):
    sents, paras = doc.prose()
    lens = [s[2] for s in sents]
    mean = _mean(lens)
    sd = _stdev(lens)
    plens = [p[2] for p in paras]
    pmean = _mean(plens)
    openers = Counter(s[3] for s in sents if s[3] and s[3] != "i" and not s[3][0].isdigit())
    run = best = 0
    prev = None
    for s in sents:
        w = s[3]
        if w and w != "i" and w == prev:
            run += 1
        else:
            run = 1
        prev = w
        best = max(best, run)
    top = [x for x in openers.most_common(1) if x[1] >= 2]
    c, x = contraction_counts(doc.low)
    return {
        "sentences": len(sents), "sentence_mean": mean, "sentence_stdev": sd, "sentence_cv": (sd / mean) if mean else 0.0,
        "paragraphs": len(paras), "paragraph_mean": pmean,
        "paragraph_cv": (_stdev(plens) / pmean) if pmean else 0.0,
        "top_opener": (top[0][0], top[0][1]) if top else ("", 0), "opener_run": best if sents else 0,
        "contractions": c, "contraction_chances": c + x,
        "contraction_rate": (c / float(c + x)) if (c + x) else None,
    }


def analyze(text, formal=False):
    lex = load_lexicon()
    doc = Doc(text)
    n = doc.n_words
    if n == 0:
        zero = {"hits_per100": 0.0, "em_dash_per100": 0.0, "semicolon_per100": 0.0, "ellipsis_per100": 0.0, "exclamation_per100": 0.0}
        return {"doc": doc, "hits": [], "words": 0, "score": 0, "band": lex.band(0), "contributors": [], "densities": zero,
                "rhythm": rhythm_measures(doc), "formal": bool(formal)}
    hits = find_hits(doc, lex)
    denom = float(max(n, lex.floor_words))
    per = 100.0 / denom
    raw = {"words": 0.0, "phrases": 0.0, "openers_closers": 0.0, "structures": 0.0}
    counters = {k: Counter() for k in raw}
    for h in hits:
        raw[h.cat] += lex.sev_points[h.sev] * lex.mult[h.cat] * per
        counters[h.cat][h.label] += 1
    comps = [{"id": k, "raw": raw[k], "detail": _top_labels(counters[k])} for k in raw]
    # punctuation
    other_raw = 0.0
    other_bits = []
    punct_counts = {}
    for ent, rx in lex.punct:
        src = doc.raw if ent.get("raw") else doc.masked
        ms = [m.span() for m in rx.finditer(src)]
        cnt = len(ms)
        punct_counts[ent["id"]] = cnt
        allowed = 0.0 if ent["id"] == "em_dash" else max(1.0, ent["free_per100"] * denom / 100.0)
        excess = max(0.0, cnt - allowed) * per
        pts = ent["pts_per100"] * excess
        if ent["id"] == "em_dash":
            comps.append({"id": "em_dash", "raw": pts,
                          "detail": "%d found, %.1f per 100 words" % (cnt, cnt * 100.0 / max(n, 1)) if cnt else ""})
            for s, e in ms:
                hits.append(Hit("punctuation", ent["label"], s, e, 3, ent))
        else:
            other_raw += pts
            if pts > 0:
                other_bits.append("%s %d" % (ent["label"], cnt))
                for s, e in ms:
                    hits.append(Hit("punctuation", ent["label"], s, e, 2, ent))
    comps.append({"id": "punctuation", "raw": other_raw, "detail": ", ".join(other_bits)})
    # rhythm and register
    rh = lex.rhythm
    rm = rhythm_measures(doc)
    rr = 0.0
    bits = []
    ns = rm["sentences"]
    if ns >= rh["min_sentences"]:
        rel = min(1.0, (ns - rh["min_sentences"] + 1.0) / (rh["full_at_sentences"] - rh["min_sentences"] + 1.0))
        cfg = rh["sentence_cv"]
        pen = cfg["pts"] * max(0.0, (cfg["ok"] - rm["sentence_cv"]) / cfg["ok"]) * rel
        if pen > 0.05:
            rr += pen
            bits.append("even sentence lengths (CV %.2f)" % rm["sentence_cv"])
        cfg = rh["sentence_mean"]
        pen = 0.0 if formal else min(cfg["cap"], cfg["pts_per_word"] * max(0.0, rm["sentence_mean"] - cfg["ok"])) * rel
        if pen > 0.05:
            rr += pen
            bits.append("long sentences (mean %.0f words)" % rm["sentence_mean"])
        cfg = rh["opener_share"]
        if ns >= cfg["min_sentences"] and rm["top_opener"][1]:
            share = rm["top_opener"][1] / float(ns)
            pen = cfg["pts"] * max(0.0, (share - cfg["ok"]) / (1.0 - cfg["ok"])) * rel
            if pen > 0.05:
                rr += pen
                bits.append("repeated opener '%s' (%d of %d)" % (rm["top_opener"][0], rm["top_opener"][1], ns))
        cfg = rh["opener_run"]
        pen = min(cfg["cap"], cfg["pts_per_extra"] * max(0, rm["opener_run"] - cfg["ok"])) * rel
        if pen > 0.05:
            rr += pen
            bits.append("%d sentences in a row start alike" % rm["opener_run"])
    cfg = rh["paragraph_cv"]
    if rm["paragraphs"] >= cfg["min_paragraphs"]:
        pen = cfg["pts"] * max(0.0, (cfg["ok"] - rm["paragraph_cv"]) / cfg["ok"])
        if pen > 0.05:
            rr += pen
            bits.append("uniform paragraphs (CV %.2f)" % rm["paragraph_cv"])
    cfg = rh["contractions"]
    if not formal and rm["contraction_chances"] >= cfg["min_chances"]:
        pen = cfg["pts"] * max(0.0, (cfg["ok_rate"] - rm["contraction_rate"]) / cfg["ok_rate"])
        if pen > 0.05:
            rr += pen
            bits.append("few contractions (%d of %d chances)" % (rm["contractions"], rm["contraction_chances"]))
    comps.append({"id": "rhythm", "raw": rr, "detail": ", ".join(bits)})
    total = sum(c["raw"] for c in comps)
    score_f = 100.0 * (1.0 - math.exp(-total / lex.scale)) if total > 0 else 0.0
    score = int(round(score_f))
    for c in comps:
        c["label"] = CONTRIB_LABELS[c["id"]]
        c["points"] = _r2(score_f * c["raw"] / total) if total > 0 else 0.0
        c["raw"] = _r2(c["raw"])
    comps = [c for c in comps if c["points"] > 0]
    comps.sort(key=lambda c: (-c["points"], c["id"]))
    lexical = sum(1 for h in hits if h.cat != "punctuation")
    dens = {
        "hits_per100": _r2(lexical * 100.0 / max(n, 1)),
        "em_dash_per100": _r2(punct_counts.get("em_dash", 0) * 100.0 / max(n, 1)),
        "semicolon_per100": _r2(punct_counts.get("semicolon", 0) * 100.0 / max(n, 1)),
        "ellipsis_per100": _r2(punct_counts.get("ellipsis", 0) * 100.0 / max(n, 1)),
        "exclamation_per100": _r2(punct_counts.get("exclamation", 0) * 100.0 / max(n, 1)),
    }
    hits.sort(key=lambda h: (h.start, h.end))
    return {
        "doc": doc, "hits": hits, "words": n, "score": score, "band": lex.band(score), "contributors": comps,
        "densities": dens, "rhythm": rm, "formal": bool(formal),
    }


def hit_dict(doc, h, with_why=True):
    text = " ".join(doc.raw[h.start:h.end].split())
    if h.cat == "punctuation" and h.ent.get("id") == "em_dash":
        text = "em dash"
    if len(text) > 60:
        text = text[:57] + "..."
    a, b = max(0, h.start - 34), min(len(doc.raw), h.end + 34)
    snip = " ".join(doc.raw[a:b].split())
    d = {"line": doc.line_of(h.start), "col": doc.col_of(h.start), "category": h.cat, "label": h.label, "text": text,
         "sev": h.sev, "fix": h.ent.get("fix", ""), "snippet": ("..." if a > 0 else "") + snip + ("..." if b < len(doc.raw) else "")}
    if with_why:
        d["why"] = h.ent.get("why", "")
    return d


CAT_NAMES = {"words": "word", "phrases": "phrase", "openers_closers": "opener/closer", "structures": "structure", "punctuation": "punct"}


def scan_result(text, formal=False, limit=None):
    r = analyze(text, formal)
    doc = r["doc"]
    sents, paras = doc.prose()
    chosen = r["hits"]
    if limit:
        top = sorted(chosen, key=lambda h: (-h.sev, h.start))[:limit]
        chosen = sorted(top, key=lambda h: (h.start, h.end))
    rm = r["rhythm"]
    out = {
        "words": r["words"], "sentences": len(sents), "paragraphs": len(paras),
        "score": r["score"], "band": r["band"], "formal_mode": r["formal"],
        "contributors": [{"id": c["id"], "label": c["label"], "points": c["points"], "detail": c["detail"]} for c in r["contributors"]],
        "densities": r["densities"],
        "rhythm": {
            "sentence_mean": _r2(rm["sentence_mean"]), "sentence_stdev": _r2(rm["sentence_stdev"]), "sentence_cv": _r2(rm["sentence_cv"]),
            "sentence_cv_ok": load_lexicon().rhythm["sentence_cv"]["ok"], "paragraph_mean": _r2(rm["paragraph_mean"]), "paragraph_cv": _r2(rm["paragraph_cv"]),
            "top_opener": rm["top_opener"][0], "top_opener_count": rm["top_opener"][1], "opener_run": rm["opener_run"],
            "contractions": rm["contractions"], "contraction_chances": rm["contraction_chances"],
            "contraction_rate": None if rm["contraction_rate"] is None else _r2(rm["contraction_rate"]),
        },
        "hit_count": len(r["hits"]),
        "hits": [hit_dict(doc, h) for h in chosen],
    }
    return out


def render_scan(res, name):
    L = ["humanizer scan: %s" % name,
         "Words %d  Sentences %d  Paragraphs %d" % (res["words"], res["sentences"], res["paragraphs"]),
         "Accent score %d/100 (%s)%s" % (res["score"], res["band"], "  [formal mode: contractions and long sentences ignored]" if res["formal_mode"] else "")]
    if res["words"] == 0:
        L.append("No text to scan.")
        return "\n".join(L)
    if res["contributors"]:
        L.append("Top contributors:")
        for i, c in enumerate(res["contributors"][:3], 1):
            L.append("  %d. %s: %.0f pts%s" % (i, c["label"], c["points"], " (%s)" % c["detail"] if c["detail"] else ""))
    d = res["densities"]
    L.append("Per 100 words: tells %.1f | em dashes %.1f | semicolons %.1f | ellipses %.1f | exclamations %.1f"
             % (d["hits_per100"], d["em_dash_per100"], d["semicolon_per100"], d["ellipsis_per100"], d["exclamation_per100"]))
    rm = res["rhythm"]
    if res["sentences"] >= 3:
        cr = "n/a" if rm["contraction_rate"] is None else "%d of %d chances (%d%%)" % (rm["contractions"], rm["contraction_chances"], round(rm["contraction_rate"] * 100))
        L.append("Rhythm: sentences average %.1f words (stdev %.1f, CV %.2f; people are usually above %.2f); paragraph CV %.2f"
                 % (rm["sentence_mean"], rm["sentence_stdev"], rm["sentence_cv"], rm["sentence_cv_ok"], rm["paragraph_cv"]))
        L.append("        top opener '%s' x%d, longest same-opener run %d, contractions %s"
                 % (rm["top_opener"] or "-", rm["top_opener_count"], rm["opener_run"], cr))
    else:
        L.append("Rhythm: too little text for stable sentence stats.")
    hits = res["hits"]
    if hits:
        more = res["hit_count"] - len(hits)
        L.append("Hits (%d%s):" % (res["hit_count"], ", showing %d, worst first; --limit 0 for all" % len(hits) if more > 0 else ""))
        for h in hits:
            L.append("  %-8s %-13s \"%s\" (sev %d) -> %s" % ("L%d:%d" % (h["line"], h["col"]), CAT_NAMES.get(h["category"], h["category"]), h["text"], h["sev"], h["fix"]))
            L.append("         %s" % h["snippet"])
    else:
        L.append("No tells found.")
    return "\n".join(L)


# --------------------------------------------------------------------------- fact guard

_ONES = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
         "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17,
         "eighteen": 18, "nineteen": 19}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
_SCALE = {"hundred": 100, "thousand": 1000, "million": 10 ** 6, "billion": 10 ** 9}
_MAG = {"k": 1e3, "thousand": 1e3, "m": 1e6, "mm": 1e6, "million": 1e6, "b": 1e9, "bn": 1e9, "billion": 1e9, "trillion": 1e12}
_UNITS = {
    "second": "second", "seconds": "second", "sec": "second", "secs": "second", "minute": "minute", "minutes": "minute",
    "min": "minute", "mins": "minute", "hour": "hour", "hours": "hour", "hr": "hour", "hrs": "hour", "day": "day", "days": "day",
    "week": "week", "weeks": "week", "wk": "week", "wks": "week", "month": "month", "months": "month", "year": "year",
    "years": "year", "yr": "year", "yrs": "year", "km": "km", "kilometer": "km", "kilometers": "km", "kilometre": "km",
    "kilometres": "km", "mile": "mile", "miles": "mile", "meter": "m", "meters": "m", "metre": "m", "metres": "m", "cm": "cm",
    "mm": "mm", "kg": "kg", "kilogram": "kg", "kilograms": "kg", "lb": "lb", "lbs": "lb", "oz": "oz", "ml": "ml",
    "liter": "l", "liters": "l", "litre": "l", "litres": "l", "gb": "gb", "mb": "mb", "tb": "tb", "kb": "kb", "mph": "mph",
    "kph": "kph", "px": "px", "fps": "fps", "hz": "hz", "khz": "khz", "mhz": "mhz", "ghz": "ghz",
}
_CUR_SYM = {"$": "USD", "\u20ac": "EUR", "\u00a3": "GBP", "\u00a5": "JPY", "\u20b9": "INR", "US$": "USD", "C$": "CAD", "A$": "AUD"}
_CUR_WORD = {"dollar": "USD", "dollars": "USD", "buck": "USD", "bucks": "USD", "euro": "EUR", "euros": "EUR"}
_NUM = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
_MON = r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
_MAGP = r"(?:k|K|m|M|mm|b|B|bn|thousand|million|billion|trillion)"

_R_URL = re.compile(r"\b(?:https?://|www\.)[^\s<>\"']+|\b(?:[a-z0-9-]{1,63}\.){1,5}(?:com|org|net|io|ai|dev|app|edu|gov|info|biz|xyz|ly|tv|sh|co|uk|eu|de|fr|nl|be|ca|au)\b(?:/[^\s<>\"']*)?", re.I)
_R_HANDLE = re.compile(r"(?<![\w@.])@[A-Za-z0-9_]{2,30}(?![\w@])")
_R_HASH = re.compile(r"(?<![\w#&])#[A-Za-z][A-Za-z0-9_]*")
_R_QUOTE = re.compile(r'"([^"\n]{2,240}?)"')
_R_TIME_AMPM = re.compile(r"(?<![\w:.])(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s?(?:([ap])\.m\.|([ap])m\b)", re.I)
_R_TIME_24 = re.compile(r"(?<![\w:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])")
_R_ISO = re.compile(r"\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b")
_R_DNUM = re.compile(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b")
_R_MDY = re.compile(r"\b(" + _MON + r")\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b", re.I)
_R_DMY = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(" + _MON + r")\.?(?:,?\s+(\d{4}))?\b", re.I)
_R_MY = re.compile(r"\b(" + _MON + r")\.?,?\s+(\d{4})\b", re.I)
_R_MONEY_SYM = re.compile(r"(?<![\w$])(US\$|C\$|A\$|[$\u20ac\u00a3\u00a5\u20b9])\s?(" + _NUM + r")(?:\s?(" + _MAGP + r")\b)?")
_R_MONEY_CODE = re.compile(r"\b(USD|EUR|GBP|CAD|AUD|CHF|JPY|INR)\s?(" + _NUM + r")(?:\s?(" + _MAGP + r")\b)?")
_R_MONEY_WORD = re.compile(r"(?<![\w$.,])(" + _NUM + r")(?:\s?(" + _MAGP + r")\b)?\s?(dollars?|euros?|bucks?|USD|EUR|GBP|CAD|AUD|CHF|JPY|INR)\b", re.I)
_R_PCT = re.compile(r"(?<![\w.,])(" + _NUM + r")\s?(?:%|percent\b|per\s?cent\b|pct\b)", re.I)
_R_NUMTOK = re.compile(r"(?<![\w.,])(" + _NUM + r")(?!\d)")
_R_ORD = re.compile(r"(?:st|nd|rd|th)(?![A-Za-z0-9])")
_R_MAG_ATT = re.compile(r"(k|K|M|B|bn)(?![A-Za-z0-9])")
_R_MAG_SP = re.compile(r"\s(thousand|million|billion|trillion)(?![A-Za-z0-9])", re.I)
_R_TIMES = re.compile(r"x(?![A-Za-z0-9])")
_R_UNIT = re.compile(r"[-\s]?(" + "|".join(sorted(_UNITS, key=len, reverse=True)) + r")(?![A-Za-z0-9])", re.I)
_R_NUMWORD = re.compile(
    r"\b(?:(?:(?P<tens>twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s](?P<ones>one|two|three|four|five|six|seven|eight|nine))?"
    r"|(?P<small>zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))"
    r"(?:\s+(?P<scale>hundred|thousand|million|billion))?|(?P<bare>hundred|thousand|million|billion))\b", re.I)
_R_IDENT = re.compile(r"(?<![A-Za-z0-9])(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]+(?![A-Za-z0-9])")
_R_ACR = re.compile(r"(?<![A-Za-z0-9])[A-Z][A-Z0-9&]+(?![A-Za-z0-9])")
_R_LISTNUM = re.compile(r"(?m)^([ \t]*)\d{1,3}[.)](?=\s)")
_R_WORDU = re.compile(r"[^\W\d_]+(?:['-][^\W\d_]+)*")
_R_CONTR = re.compile(r"(?:n't|'re|'ve|'ll|'d|'m)$", re.I)
_R_HEADLINE = re.compile(r"(?im)^[ \t]*(?:subject|re|fwd?|title|headline|heading)[ \t]*:.*$|^[ \t]*#{1,6}[ \t].*$")
_R_SUBJ_VERB = re.compile(
    r" +(?:will|would|can|could|should|shall|may|might|must|said|says|asked|asks|wrote|writes|replied|replies|called|calls|emailed|emails"
    r"|texted|sent|sends|joined|joins|left|leaves|works|worked|lives|lived|knows|knew|told|tells|suggested|suggests|agreed|agrees"
    r"|mentioned|mentions|confirmed|confirms|thinks|thought|wants|wanted|needs|needed|loves|likes|hopes|feels|felt|got|gets|took|takes"
    r"|made|makes|went|goes|came|comes|saw|sees|found|finds|gave|gives|runs|ran|leads|led|manages|managed|owns|owned|plans|planned"
    r"|prefers|preferred|promised|proposed|recommended|recommends|hired|quit|started|starts|finished|finishes|met|meets|spoke|speaks|visited|visits"
    r"|(?:is|was|will be) (?:out|away|off|on leave|traveling|travelling|sick|late|back|free|busy|unavailable|leaving|joining))\b")
_NAME_STOP = set("""the a an this that these those we our i it he she they you in on at if but and so then when while as by for to with
not no yes what which who how why where there here his her their its my your also just now today tomorrow yesterday dear hi hello
thanks thank please best regards sincerely of or is are was were be do does did have has had will would can could should may might
one two three four five six seven eight nine ten first second third next last after before during since until because though although
however therefore meanwhile finally overall additionally moreover furthermore instead otherwise still yet even only more most some
any all each every both either neither many much few several such other another same""".split())
_TITLES = {"mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "sir", "madam"}
_DAYS = {"mon": "monday", "tue": "tuesday", "tues": "tuesday", "wed": "wednesday", "thu": "thursday", "thur": "thursday",
         "thurs": "thursday", "fri": "friday", "sat": "saturday", "sun": "sunday"}
_DAY_RE = re.compile(r"\b(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b\.?|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s\b")
_KIND_SEV = {"num": "error", "date": "error", "time": "error", "email": "error", "url": "error", "handle": "error",
             "hashtag": "warn", "quote": "warn", "acronym": "warn", "name": "warn"}
_KIND_LABEL = {"num": "number", "date": "date", "time": "time", "email": "email", "url": "link", "handle": "@handle",
               "hashtag": "hashtag", "quote": "quote", "acronym": "acronym", "name": "name"}


def _days_text(cf):
    """Casefolded text with weekday abbreviations and plurals turned into the singular full name."""
    return _DAY_RE.sub(lambda m: _DAYS[m.group(1)] if m.group(1) else m.group(2), cf)


def _canon_day(tok):
    low = tok.lower()
    if low in _DAYS:
        return _DAYS[low].capitalize()
    if len(low) > 3 and low.endswith("s") and _DAYS.get(low[:3]) == low[:-1]:
        return tok[:-1]
    return tok


def _vkey(v):
    return ("%.6f" % v).rstrip("0").rstrip(".")


def _pnum(s):
    return float(s.replace(",", ""))


def _norm_url(u):
    u = u.strip().rstrip(".,;:!?)\"'").lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    return u.rstrip("/")


def _norm_ws(s):
    return re.sub(r"\s+", " ", s).strip()


def _month(tok):
    return _MONTHS.index(tok[:3].lower()) + 1


def _year(y):
    y = int(y)
    return y if y >= 100 else (2000 + y if y < 70 else 1900 + y)


def extract_facts(text):
    """Hard facts in a text: numbers with units, money, percents, dates, times, links, handles, quotes, acronyms, names."""
    t = text.translate(_CHARMAP)
    t = _R_LISTNUM.sub(lambda m: m.group(1) + "  ", t)
    n = len(t)
    taken = bytearray(n)
    line_starts = [0] + [m.end() for m in re.finditer("\n", t)]
    facts = []
    seen = set()

    def free(s, e):
        return taken.find(1, s, e) == -1

    def take(s, e):
        taken[s:e] = b"\x01" * (e - s)

    def add(kind, key, s, e, unit="", value=None, consume=True, **extra):
        if consume:
            take(s, e)
        ident = (kind, key, unit)
        if ident in seen:
            return
        seen.add(ident)
        f = {"kind": kind, "key": key, "unit": unit, "value": value, "text": extra.pop("shown", None) or " ".join(t[s:e].split()),
             "line": bisect.bisect_right(line_starts, s), "sev": _KIND_SEV[kind], "label": _KIND_LABEL[kind]}
        f.update(extra)
        facts.append(f)

    for a, b in email_spans(t):
        if free(a, b):
            add("email", t[a:b].lower(), a, b)
    for m in _R_URL.finditer(t):
        s, e = m.span()
        core = m.group(0).rstrip(".,;:!?)\"'")
        e = s + len(core)
        if free(s, e) and len(core) > 3:
            add("url", _norm_url(core), s, e)
    for m in _R_HANDLE.finditer(t):
        if free(*m.span()):
            add("handle", m.group(0).lower(), m.start(), m.end())
    for m in _R_HASH.finditer(t):
        if free(*m.span()):
            add("hashtag", m.group(0).lower(), m.start(), m.end())
    for m in _R_QUOTE.finditer(t):
        inner = m.group(1)
        if re.search(r"[A-Za-z]", inner):
            add("quote", _norm_ws(inner.casefold()).strip(" .,;:!?"), m.start(), m.end(), consume=False)
    for m in _R_TIME_AMPM.finditer(t):
        s, e = m.span()
        hh = int(m.group(1))
        if not free(s, e) or not 1 <= hh <= 12:
            continue
        mm = int(m.group(2) or 0)
        if mm > 59:
            continue
        pm = (m.group(3) or m.group(4)).lower() == "p"
        hh = (hh % 12) + (12 if pm else 0)
        add("time", "%02d:%02d" % (hh, mm), s, e)
    for m in _R_TIME_24.finditer(t):
        if free(*m.span()):
            add("time", "%02d:%02d" % (int(m.group(1)), int(m.group(2))), m.start(), m.end())
    # dates
    for m in _R_ISO.finditer(t):
        if free(*m.span()):
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if 1 <= mo <= 12 and 1 <= d <= 31:
                add("date", "%04d-%02d-%02d" % (y, mo, d), m.start(), m.end(), year=y, md="--%02d-%02d" % (mo, d))
    for m in _R_DNUM.finditer(t):
        if free(*m.span()):
            a, b, y = int(m.group(1)), int(m.group(2)), _year(m.group(3))
            if a > 12 and b <= 12:
                d, mo = a, b
            elif b > 12 and a <= 12:
                mo, d = a, b
            elif a == b and a <= 12:
                mo, d = a, b
            elif a <= 12 and b <= 12:
                add("date", "amb:%d/%d/%d" % (a, b, y), m.start(), m.end(), year=y, md="amb:%d/%d" % (a, b))
                continue
            else:
                continue
            add("date", "%04d-%02d-%02d" % (y, mo, d), m.start(), m.end(), year=y, md="--%02d-%02d" % (mo, d))
    for rx, order in ((_R_MDY, "md"), (_R_DMY, "dm")):
        for m in rx.finditer(t):
            if not free(*m.span()):
                continue
            mon = m.group(1) if order == "md" else m.group(2)
            day = m.group(2) if order == "md" else m.group(1)
            if mon.lower() == "may" and not mon[0].isupper():
                continue
            d = int(day)
            if not 1 <= d <= 31:
                continue
            mo = _month(mon)
            y = int(m.group(3)) if m.group(3) else None
            key = ("%04d-%02d-%02d" % (y, mo, d)) if y else "--%02d-%02d" % (mo, d)
            add("date", key, m.start(), m.end(), year=y, md="--%02d-%02d" % (mo, d))
    for m in _R_MY.finditer(t):
        if free(*m.span()):
            y = int(m.group(2))
            add("date", "%04d-%02d" % (y, _month(m.group(1))), m.start(), m.end(), year=y, md="--%02d" % _month(m.group(1)))

    def magnitude(tok):
        return _MAG.get(tok.lower(), 1) if tok else 1

    for m in _R_MONEY_SYM.finditer(t):
        if free(*m.span()):
            v = _pnum(m.group(2)) * magnitude(m.group(3))
            add("num", _vkey(v), m.start(), m.end(), unit=_CUR_SYM[m.group(1)], value=v)
    for m in _R_MONEY_CODE.finditer(t):
        if free(*m.span()):
            v = _pnum(m.group(2)) * magnitude(m.group(3))
            add("num", _vkey(v), m.start(), m.end(), unit=m.group(1).upper(), value=v)
    for m in _R_MONEY_WORD.finditer(t):
        if free(*m.span()):
            v = _pnum(m.group(1)) * magnitude(m.group(2))
            w = m.group(3).lower()
            add("num", _vkey(v), m.start(), m.end(), unit=_CUR_WORD.get(w, w.upper()), value=v)
    for m in _R_PCT.finditer(t):
        if free(*m.span()):
            v = _pnum(m.group(1))
            add("num", _vkey(v), m.start(), m.end(), unit="%", value=v)
    # plain numbers, with a following unit or magnitude
    for m in _R_NUMTOK.finditer(t):
        s, e = m.span()
        if not free(s, e):
            continue
        v = _pnum(m.group(1))
        unit = ""
        end = e
        tail = t[e:e + 24]
        mm = _R_ORD.match(tail)
        if mm:
            unit, end = "ord", e + mm.end()
        else:
            mm = _R_MAG_ATT.match(tail)
            if mm:
                v *= {"k": 1e3, "K": 1e3, "M": 1e6, "B": 1e9, "bn": 1e9}[mm.group(1)]
                end = e + mm.end()
            else:
                mm = _R_MAG_SP.match(tail)
                if mm:
                    v *= _MAG[mm.group(1).lower()]
                    end = e + mm.end()
            mm = _R_TIMES.match(t[end:end + 4])
            if mm and end == e:
                unit, end = "x", end + mm.end()
            else:
                um = _R_UNIT.match(t, end)
                if um:
                    unit, end = _UNITS[um.group(1).lower()], um.end()
        if end == e and e < n and t[e].isalpha():
            continue
        add("num", _vkey(v), s, end, unit=unit, value=v)
    # number words
    for m in _R_NUMWORD.finditer(t):
        s, e = m.span()
        if not free(s, e):
            continue
        if m.group("bare"):
            v = _SCALE[m.group("bare").lower()]
        else:
            if m.group("tens"):
                v = _TENS[m.group("tens").lower()] + (_ONES[m.group("ones").lower()] if m.group("ones") else 0)
            else:
                v = _ONES[m.group("small").lower()]
            if m.group("scale"):
                v *= _SCALE[m.group("scale").lower()]
        um = _R_UNIT.match(t, e)
        unit = _UNITS[um.group(1).lower()] if um else ""
        end = um.end() if um else e
        if not unit and re.match(r"\s?(?:%|percent\b|dollars?\b|euros?\b)", t[e:e + 12], re.I):
            unit = "%" if re.match(r"\s?(?:%|percent)", t[e:e + 12], re.I) else "USD"
        if v == 1 and not m.group("scale") and not m.group("bare") and not unit:
            if not re.search(r"(?:number|no\.?|#)\s*$", t[max(0, s - 10):s], re.I):
                continue
        add("num", _vkey(v), s, end, unit=unit, value=float(v))
    # identifiers and acronyms
    for m in _R_IDENT.finditer(t):
        if free(*m.span()) and len(m.group(0)) >= 2:
            add("acronym", m.group(0), m.start(), m.end())
    for m in _R_ACR.finditer(t):
        if free(*m.span()):
            add("acronym", m.group(0), m.start(), m.end())
    # names: capitalized words, grouped into sequences; sentence-initial single words only with a person-verb after them
    seq = []
    prev_end = -1
    head = [(m.start(), m.end()) for m in _R_HEADLINE.finditer(t)]
    head_starts = [h[0] for h in head]

    def in_head(pos):
        k = bisect.bisect_right(head_starts, pos) - 1
        return k >= 0 and pos < head[k][1]

    def flush():
        if not seq:
            return
        s0, e0 = seq[0][0], seq[-1][1]
        toks = [x[2] for x in seq]
        seq[:] = []
        if not free(s0, e0):
            return
        if at_sentence_start(t, s0):
            stripped = False
            while toks and toks[0].lower() in _NAME_STOP:
                toks = toks[1:]
                stripped = True
            if not toks:
                return
            if not stripped and len(toks) == 1 and not _R_SUBJ_VERB.match(t, e0):
                return
        if len(toks) == 1 and toks[0].lower() in _NAME_STOP:
            return
        name = " ".join(_canon_day(x) for x in toks)
        add("name", name, s0, e0, consume=False, shown=name)

    for m in _R_WORDU.finditer(t):
        tok = m.group(0)
        st, en = m.span()
        if _R_CONTR.search(tok):
            flush()
            continue
        if head and in_head(st):
            flush()
            continue
        possessive = tok.endswith("'s")
        core = tok[:-2] if possessive else tok
        namelike = bool(core) and core.lower() not in _TITLES and (
            (core[0].isupper() and any(c.islower() for c in core[1:]))
            or (core[0].islower() and any(c.isupper() for c in core[1:])))
        if not namelike:
            flush()
            prev_end = en
            continue
        if seq and t[prev_end:st] != " ":
            flush()
        seq.append((st, st + len(core), core))
        prev_end = en
        if possessive:
            flush()
    flush()
    return facts


class _Ctx:
    def __init__(self, text, facts):
        self.text = text.translate(_CHARMAP)
        self.cf = self.text.casefold()
        self.cf_names = _days_text(self.cf)
        self.nums = {}
        self.keys = {}
        self.mds = set(f["md"] for f in facts if f["kind"] == "date")
        for f in facts:
            if f["kind"] == "num":
                self.nums.setdefault(f["key"], set()).add(f["unit"])
            else:
                self.keys.setdefault(f["kind"], set()).add(f["key"])
        self.url_text = re.sub(r"https?://|www\.", "", self.cf)
        self.quote_text = _norm_ws(self.cf)


def _presence(f, c):
    k = f["kind"]
    if k == "num":
        units = c.nums.get(f["key"])
        if not units:
            return "missing"
        u = f["unit"]
        if not u or "" in units or u in units:
            return "ok"
        return "unit"
    if k in ("date", "time"):
        ks = c.keys.get(k, ())
        if f["key"] in ks:
            return "ok"
        if k == "date" and f.get("year") and f["md"] in ks:
            return "yeardrop"
        if k == "date" and not f.get("year") and f["md"] in c.mds:
            return "ok"
        return "missing"
    if k == "email":
        return "ok" if f["key"] in c.cf else "missing"
    if k == "url":
        return "ok" if f["key"] in c.url_text else "missing"
    if k in ("handle", "hashtag"):
        return "ok" if re.search(r"(?<![\w@#])" + re.escape(f["key"]) + r"(?!\w)", c.cf) else "missing"
    if k == "quote":
        return "ok" if f["key"] in c.quote_text else "missing"
    if k == "acronym":
        return "ok" if re.search(r"(?<![A-Za-z0-9])" + re.escape(f["key"]) + r"(?![A-Za-z0-9])", c.text) else "missing"
    if k == "name":
        key = f["key"].casefold()
        if re.search(r"(?<!\w)" + re.escape(key) + r"(?!\w)", c.cf_names):
            return "ok"
        parts = [p for p in key.split(" ") if p]
        if len(parts) > 1:
            found = sum(1 for p in parts if re.search(r"(?<!\w)" + re.escape(p) + r"(?!\w)", c.cf_names))
            if found * 2 >= len(parts):
                return "ok"
        return "missing"
    return "ok"


def fact_guard(before, after):
    fb, fa = extract_facts(before), extract_facts(after)
    cb, ca = _Ctx(before, fb), _Ctx(after, fa)
    problems = []
    kept = 0
    changed_keys = set()
    for f in fb:
        st = _presence(f, ca)
        if st == "ok":
            kept += 1
            continue
        if st == "unit":
            changed_keys.add(f["key"])
        sev = "warn" if st == "yeardrop" else f["sev"]
        detail = {"missing": "not found in AFTER", "unit": "AFTER has the same value with a different unit",
                  "yeardrop": "the year was dropped in AFTER"}[st]
        problems.append({"type": "changed" if st != "missing" else "missing", "sev": sev, "kind": f["label"], "text": f["text"],
                         "line": f["line"], "detail": detail})
    for f in fa:
        st = _presence(f, cb)
        if st == "ok" or (st == "unit" and f["key"] in changed_keys):
            continue
        problems.append({"type": "added", "sev": f["sev"], "kind": f["label"], "text": f["text"], "line": f["line"],
                         "detail": "not in BEFORE, possible invention"})
    errors = sum(1 for p in problems if p["sev"] == "error")
    warnings = sum(1 for p in problems if p["sev"] == "warn")
    missing = sum(1 for p in problems if p["type"] != "added")
    return {"total": len(fb), "kept": len(fb) - missing, "problems": problems, "errors": errors, "warnings": warnings,
            "added": sum(1 for p in problems if p["type"] == "added")}


def facts_phrase(g):
    if g["total"] == 0:
        tail = "no numbers or names to guard"
    elif g["kept"] == g["total"]:
        tail = "1 fact kept" if g["total"] == 1 else "all %d facts kept" % g["total"]
    else:
        tail = "%d of %d facts kept" % (g["kept"], g["total"])
    if g["added"]:
        tail += ", %d possible addition%s" % (g["added"], "" if g["added"] == 1 else "s")
    return tail


def summary_line(sb, sa, g):
    return "Accent score %d -> %d, %s." % (sb, sa, facts_phrase(g))


def compare_result(before, after, formal=False):
    rb, ra = analyze(before, formal), analyze(after, formal)
    g = fact_guard(before, after)
    doc = ra["doc"]
    return {
        "before": {"score": rb["score"], "band": rb["band"], "words": rb["words"]},
        "after": {"score": ra["score"], "band": ra["band"], "words": ra["words"],
                  "contributors": [{"label": c["label"], "points": c["points"], "detail": c["detail"]} for c in ra["contributors"][:3]],
                  "remaining_hits": [hit_dict(doc, h, with_why=False) for h in sorted(ra["hits"], key=lambda h: (-h.sev, h.start))[:8]]},
        "delta": ra["score"] - rb["score"],
        "fact_guard": g,
        "summary": summary_line(rb["score"], ra["score"], g),
        "ok": g["errors"] == 0,
    }


def render_compare(res, bname, aname):
    b, a, g = res["before"], res["after"], res["fact_guard"]
    L = ["humanizer compare: %s -> %s" % (bname, aname),
         "Accent score %d (%s) -> %d (%s), change %+d" % (b["score"], b["band"], a["score"], a["band"], res["delta"])]
    if a["score"] > 15 and a["contributors"]:
        L.append("AFTER top contributors:")
        for i, c in enumerate(a["contributors"], 1):
            L.append("  %d. %s: %.0f pts%s" % (i, c["label"], c["points"], " (%s)" % c["detail"] if c["detail"] else ""))
        for h in a["remaining_hits"][:6]:
            L.append("  L%d:%d \"%s\" -> %s" % (h["line"], h["col"], h["text"], h["fix"]))
    L.append("FACT GUARD: %d fact%s in BEFORE, %d kept" % (g["total"], "" if g["total"] == 1 else "s", g["kept"]))
    for p in g["problems"]:
        L.append("  %-5s %s %s \"%s\" (line %d): %s" % ("ERROR" if p["sev"] == "error" else "WARN", p["type"], p["kind"], p["text"], p["line"], p["detail"]))
    if g["errors"]:
        L.append("Result: FAIL, %d error%s, %d warning%s. Fix the errors before delivering."
                 % (g["errors"], "" if g["errors"] == 1 else "s", g["warnings"], "" if g["warnings"] == 1 else "s"))
    elif g["warnings"]:
        L.append("Result: ok with %d warning%s. Check each one against the original." % (g["warnings"], "" if g["warnings"] == 1 else "s"))
    else:
        L.append("Result: ok, nothing lost, nothing added.")
    L.append("Summary line: %s" % res["summary"])
    return "\n".join(L)


# --------------------------------------------------------------------------- voice

_FIRST = {"i", "i'm", "i've", "i'll", "i'd", "me", "my", "mine", "myself"}
_WE = {"we", "we're", "we've", "we'll", "we'd", "us", "our", "ours", "ourselves"}
_YOU = {"you", "you're", "you've", "you'll", "you'd", "your", "yours", "yourself", "yourselves"}
_CONJ = {"and", "but", "so", "because", "or", "yet"}
_SLANG = {"lol", "gonna", "wanna", "gotta", "yeah", "yep", "nope", "hey", "btw", "kinda", "sorta", "ok", "okay", "haha", "thx", "pls",
          "ya", "cuz", "stuff", "guys", "awesome", "cool", "super", "totally", "honestly", "basically", "literally", "damn", "hell"}


def _rate(k, n):
    return (k * 100.0 / n) if n else 0.0


def voice_metrics(text):
    doc = Doc(text)
    sents, paras = doc.prose()
    ns = len(sents)
    lens = [s[2] for s in sents]
    n = doc.n_words
    toks = [m.group(0) for m in WORD_RE.finditer(doc.low)]
    c, x = contraction_counts(doc.low)
    letters = [sum(1 for ch in t if ch.isalpha()) for t in toks if any(ch.isalpha() for ch in t)]
    q = ex = frag = conj = 0
    for a, b, k, first in sents:
        tail = doc.masked[a:b].rstrip(" \"')]")
        if tail.endswith("?"):
            q += 1
        if tail.endswith("!"):
            ex += 1
        if k <= 4:
            frag += 1
        if first in _CONJ:
            conj += 1
    opener_counts = Counter(s[3] for s in sents if s[3])
    plens = [p[2] for p in paras]
    sm = _mean(lens)
    sd = _stdev(lens)
    pm = _mean(plens)
    fp = sum(1 for t in toks if t in _FIRST)
    we = sum(1 for t in toks if t in _WE)
    you = sum(1 for t in toks if t in _YOU)
    slang = sum(1 for t in toks if t in _SLANG)
    sorted_lens = sorted(lens)
    p90 = sorted_lens[min(ns - 1, int(ns * 0.9))] if ns else 0
    med = sorted_lens[ns // 2] if ns else 0
    rate = (c / float(c + x)) if (c + x) else None
    avg_len = _mean(letters)
    q_share = q / float(ns) if ns else 0.0
    e_share = ex / float(ns) if ns else 0.0
    # formality 0-100 (rough): contractions, word length, sentence length, casual markers
    comp_c = (1.0 - rate) * 35.0 if (c + x) >= 4 else 17.5
    comp_w = min(1.0, max(0.0, (avg_len - 4.0) / 1.4)) * 25.0
    comp_s = min(1.0, max(0.0, (sm - 9.0) / 16.0)) * 20.0
    casual = min(20.0, e_share * 60.0 + q_share * 20.0 + _rate(slang, n) * 8.0 + max(0.0, _rate(fp, n) - 3.0) * 1.5)
    formality = comp_c + comp_w + comp_s + (20.0 - casual)
    dash = len(re.findall(r"[\u2014\u2015]", doc.masked)) + len(re.findall(r" (?:-|\u2013|--+) ", doc.masked))
    return {
        "words": n, "sentences": ns, "paragraphs": len(paras), "doc": doc,
        "sentence": {"mean": _r2(sm), "median": _r2(med), "stdev": _r2(sd), "cv": _r2(sd / sm) if sm else 0.0, "p90": p90,
                     "short_share": _r2(sum(1 for k in lens if k <= 6) / float(ns)) if ns else 0.0,
                     "long_share": _r2(sum(1 for k in lens if k >= 25) / float(ns)) if ns else 0.0},
        "paragraph": {"mean_words": _r2(pm), "cv": _r2(_stdev(plens) / pm) if pm else 0.0,
                      "one_sentence_share": _r2(sum(1 for p in paras if p[3] == 1) / float(len(paras))) if paras else 0.0},
        "contractions": {"rate": None if rate is None else _r2(rate), "used": c, "possible": c + x},
        "pronouns_per100": {"i": _r2(_rate(fp, n)), "we": _r2(_rate(we, n)), "you": _r2(_rate(you, n))},
        "rates": {"question_share": _r2(q_share), "exclamation_share": _r2(e_share),
                  "fragment_share": _r2(frag / float(ns)) if ns else 0.0, "conjunction_start_share": _r2(conj / float(ns)) if ns else 0.0},
        "punctuation_per100": {"em_dash": _r2(_rate(len(re.findall(r"[\u2014\u2015]", doc.masked)), n)), "dash_any": _r2(_rate(dash, n)),
                               "semicolon": _r2(_rate(doc.masked.count(";"), n)),
                               "ellipsis": _r2(_rate(len(re.findall(r"\u2026|\.{3,}", doc.masked)), n)),
                               "parenthesis": _r2(_rate(doc.masked.count("("), n)), "colon": _r2(_rate(doc.masked.count(":"), n)),
                               "comma": _r2(_rate(doc.masked.count(","), n))},
        "openers": [[w, _r2(k / float(ns))] for w, k in sorted(opener_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:6]] if ns >= 8 else [],
        "word_length": {"mean": _r2(avg_len), "long_share": _r2(sum(1 for k in letters if k >= 9) / float(len(letters))) if letters else 0.0},
        "formality": {"score": int(round(formality)), "label": "casual" if formality < 35 else ("formal" if formality >= 65 else "neutral")},
    }


def build_voice(texts):
    joined = "\n\n".join(t.strip("\n") for t in texts)
    m = voice_metrics(joined)
    acc = analyze(joined)
    prof = {"_meta": {"version": VERSION, "kind": "voice-fingerprint", "samples": len(texts), "words": m["words"], "sentences": m["sentences"],
                      "notes": "Measurements only, no sentences from the samples (the most common opening words are the only words kept). Made by scripts/tells.py fingerprint; used by match."}}
    for k in ("sentence", "paragraph", "contractions", "pronouns_per100", "rates", "punctuation_per100", "openers", "word_length", "formality"):
        prof[k] = m[k]
    prof["own_accent"] = {"score": acc["score"], "band": acc["band"]}
    return prof


def render_voice(p, saved):
    m, s, pa = p["_meta"], p["sentence"], p["paragraph"]
    c, pr, r, pu, f = p["contractions"], p["pronouns_per100"], p["rates"], p["punctuation_per100"], p["formality"]
    L = ["Voice fingerprint from %d sample%s (%d words, %d sentences)" % (m["samples"], "" if m["samples"] == 1 else "s", m["words"], m["sentences"]),
         "  Sentences: mean %.1f words, stdev %.1f (CV %.2f), %d%% under 7 words, %d%% over 24 words" % (s["mean"], s["stdev"], s["cv"], round(s["short_share"] * 100), round(s["long_share"] * 100)),
         "  Paragraphs: mean %.0f words, CV %.2f" % (pa["mean_words"], pa["cv"]),
         "  Contractions: %s" % ("n/a (too few chances)" if c["rate"] is None else "%d%% (%d of %d chances)" % (round(c["rate"] * 100), c["used"], c["possible"])),
         "  Person: I/me/my %.1f per 100 words, you %.1f, we %.1f; questions %d%% of sentences, exclamations %d%%"
         % (pr["i"], pr["you"], pr["we"], round(r["question_share"] * 100), round(r["exclamation_share"] * 100)),
         "  Per 100 words: em dashes %.1f, semicolons %.1f, ellipses %.1f, parentheses %.1f, colons %.1f"
         % (pu["em_dash"], pu["semicolon"], pu["ellipsis"], pu["parenthesis"], pu["colon"])]
    if p["openers"]:
        L.append("  Common openers: " + ", ".join("%s %d%%" % (w, round(x * 100)) for w, x in p["openers"][:5]))
    L.append("  Register: %s (formality %d/100)" % (f["label"], f["score"]))
    L.append("  Own accent score of the samples: %d (%s)" % (p["own_accent"]["score"], p["own_accent"]["band"]))
    if m["words"] < 300:
        L.append("Warning: only %d words of samples. The profile is rough; 500+ words is better." % m["words"])
    if p["own_accent"]["score"] >= 35:
        L.append("Warning: these samples score %d on the accent scale. A profile built from AI-flavored text teaches the accent back. "
                 "Use text you wrote yourself." % p["own_accent"]["score"])
    L.append(saved)
    return "\n".join(L)


def load_voice(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except OSError as ex:
        raise UserError("cannot read voice file '%s': %s" % (path, ex.strerror or ex))
    except ValueError as ex:
        raise UserError("'%s' is not valid JSON (%s)" % (path, ex))
    if not isinstance(data, dict) or data.get("_meta", {}).get("kind") != "voice-fingerprint":
        raise UserError("'%s' is not a voice fingerprint; make one with the fingerprint subcommand" % path)
    for k in ("sentence", "paragraph", "contractions", "pronouns_per100", "rates", "punctuation_per100", "formality"):
        if k not in data:
            raise UserError("'%s' is missing '%s'; re-run fingerprint" % (path, k))
    return data


def _longest_sentences(doc, k=3):
    sents, _ = doc.prose()
    top = sorted(sents, key=lambda x: (-x[2], x[0]))[:k]
    out = []
    for a, b, n, _first in sorted(top, key=lambda x: x[0]):
        words = doc.raw[a:b].split()
        out.append('"%s%s" (%d words, line %d)' % (" ".join(words[:6]), "..." if len(words) > 6 else "", n, doc.line_of(a)))
    return "; ".join(out)


def match_voice(text, voice):
    d = voice_metrics(text)
    doc = d["doc"]
    v = voice
    diffs = []
    checks = 0

    def diff(id_, msg, vv, dd):
        diffs.append({"id": id_, "message": msg, "voice": vv, "draft": dd})

    ns = d["sentences"]
    if ns == 0:
        return {"checks": 0, "differences": [], "note": "no sentences to compare"}
    # sentence length
    checks += 1
    vm, dm = v["sentence"]["mean"], d["sentence"]["mean"]
    if abs(dm - vm) >= 3 and abs(dm - vm) / max(vm, 1) >= 0.2:
        hint = "Split the longest: %s." % _longest_sentences(doc) if dm > vm else "Join a few of the short ones."
        diff("sentence_length", "Sentence length: your samples average %.0f words per sentence, this draft %.0f. %s" % (vm, dm, hint), vm, dm)
    # rhythm
    checks += 1
    vc, dc = v["sentence"]["cv"], d["sentence"]["cv"]
    if ns >= 6 and dc < vc - 0.15:
        diff("rhythm", "Rhythm: your sentence lengths vary (stdev %.1f words); this draft's are more even (stdev %.1f). Mix short and long." % (v["sentence"]["stdev"], d["sentence"]["stdev"]), vc, dc)
    elif ns >= 6 and dc > vc + 0.3:
        diff("rhythm", "Rhythm: this draft's sentence lengths swing more (stdev %.1f) than yours (%.1f). Even them out." % (d["sentence"]["stdev"], v["sentence"]["stdev"]), vc, dc)
    # contractions
    checks += 1
    vr, dr = v["contractions"]["rate"], d["contractions"]["rate"]
    if vr is not None and dr is not None and v["contractions"]["possible"] >= 5 and d["contractions"]["possible"] >= 3 and abs(vr - dr) >= 0.3:
        diff("contractions", "Contractions: you contract %d%% of the time you could, this draft %d%%. %s" % (
            round(vr * 100), round(dr * 100), "Contract more." if dr < vr else "Spell a few out."), vr, dr)
    # pronouns
    for key, label in (("i", "I/me/my"), ("you", "you/your"), ("we", "we/our")):
        checks += 1
        a, b = v["pronouns_per100"][key], d["pronouns_per100"][key]
        if d["words"] >= 60 and abs(a - b) >= 2.5 and (b >= a * 1.6 or b <= a / 1.6):
            diff("pronoun_" + key, "%s: %.1f per 100 words in your samples, %.1f in this draft." % (label, a, b), a, b)
    # questions / exclamations / fragments
    checks += 1
    a, b = v["rates"]["question_share"], d["rates"]["question_share"]
    if (a >= 0.06 and b == 0 and ns >= 8) or b >= a + 0.12:
        diff("questions", "Questions: %d%% of your sentences are questions, %d%% of this draft's." % (round(a * 100), round(b * 100)), a, b)
    checks += 1
    a, b = v["rates"]["exclamation_share"], d["rates"]["exclamation_share"]
    if b >= a + 0.08:
        diff("exclamations", "Exclamations: %d%% of your sentences end in !, %d%% of this draft's. Tone it down." % (round(a * 100), round(b * 100)), a, b)
    checks += 1
    a, b = v["rates"]["fragment_share"], d["rates"]["fragment_share"]
    if (a >= 0.10 and b == 0 and ns >= 8) or b >= a + 0.2:
        diff("fragments", "Short fragments (4 words or fewer): %d%% of your sentences, %d%% of this draft's." % (round(a * 100), round(b * 100)), a, b)
    # punctuation
    for key, label in (("dash_any", "Dashes (em dashes and dash stand-ins)"), ("semicolon", "Semicolons"), ("ellipsis", "Ellipses")):
        checks += 1
        a, b = v["punctuation_per100"].get(key, v["punctuation_per100"].get("em_dash", 0.0)), d["punctuation_per100"][key]
        if b >= a + 0.4:
            diff("punct_" + key, "%s: your samples use %.1f per 100 words, this draft %.1f." % (label, a, b), a, b)
    # paragraphs
    checks += 1
    a, b = v["paragraph"]["mean_words"], d["paragraph"]["mean_words"]
    if d["paragraphs"] >= 2 and abs(a - b) >= 15 and abs(a - b) / max(a, 1) >= 0.4:
        diff("paragraph_length", "Paragraph length: your samples average %.0f words per paragraph, this draft %.0f." % (a, b), a, b)
    # openers
    checks += 1
    vop = dict((w, x) for w, x in v.get("openers", []))
    dtop = [(w, k) for w, k in Counter(s[3] for s in doc.prose()[0] if s[3] and s[3] != "i").most_common(1)]
    if dtop and ns >= 6:
        w, k = dtop[0]
        if k / float(ns) >= 0.25 and vop.get(w, 0) < 0.10:
            diff("openers", "Openers: %d of %d sentences start with '%s'; your samples rarely do." % (k, ns, w), vop.get(w, 0), round(k / float(ns), 2))
    # register
    checks += 1
    a, b = v["formality"]["score"], d["formality"]["score"]
    if abs(a - b) >= 25:
        diff("register", "Register: your samples read %s (formality %d), this draft reads %s (%d)." % (v["formality"]["label"], a, d["formality"]["label"], b), a, b)
    return {"checks": checks, "differences": diffs, "draft_words": d["words"], "draft_sentences": ns}


def render_match(res, name, vname):
    L = ["humanizer match: %s against %s" % (name, vname)]
    if res.get("note"):
        L.append(res["note"])
        return "\n".join(L)
    for d in res["differences"]:
        L.append("  DIFF %s" % d["message"])
    n = len(res["differences"])
    L.append("Result: %d difference%s in %d checks%s" % (n, "" if n == 1 else "s", res["checks"], "; the draft sits close to your voice." if n == 0 else "."))
    return "\n".join(L)


# --------------------------------------------------------------------------- examples

def load_examples():
    p = ASSETS / "examples.json"
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as ex:
        raise UserError("cannot load %s: %s" % (p, ex))


def score_pair(pair):
    b, a = analyze(pair["before"]), analyze(pair["after"])
    g = fact_guard(pair["before"], pair["after"])
    return b, a, g


# --------------------------------------------------------------------------- CLI

def _out_path(arg):
    p = Path(arg)
    if p.is_absolute():
        return p
    cwd = Path.cwd().resolve()
    target = (cwd / p).resolve()
    if target != cwd and cwd not in target.parents:
        raise UserError("refusing to write outside the current directory (%s); use an absolute --out path" % arg)
    return target


def _dump(obj):
    return json.dumps(obj, indent=2, ensure_ascii=True, sort_keys=False)


def cmd_scan(a):
    if a.limit is not None and a.limit < 0:
        raise UserError("--limit must be 0 (all) or a positive number")
    text = read_source(a.file)
    limit = a.limit if a.limit is not None else (0 if a.json else 30)
    res = scan_result(text, formal=a.formal, limit=limit or None)
    name = "<stdin>" if a.file == "-" else a.file
    if a.json:
        res = dict(res)
        res["source"] = name
        print(_dump(res))
    else:
        print(render_scan(res, name))
    if a.fail_above is not None and res["score"] > a.fail_above:
        return 1
    return 0


def cmd_compare(a):
    if a.before == "-" and a.after == "-":
        raise UserError("only one of BEFORE and AFTER can be - (stdin)")
    before, after = read_source(a.before), read_source(a.after)
    res = compare_result(before, after, formal=a.formal)
    if a.json:
        print(_dump(res))
    else:
        print(render_compare(res, "<stdin>" if a.before == "-" else a.before, "<stdin>" if a.after == "-" else a.after))
    return 0 if res["ok"] else 1


def cmd_fingerprint(a):
    if a.samples.count("-") > 1:
        raise UserError("only one sample can be - (stdin)")
    texts = [read_source(p) for p in a.samples]
    if not any(t.strip() for t in texts):
        raise UserError("the samples contain no text")
    prof = build_voice(texts)
    saved = "Add --out voice.json to save this profile."
    if a.out:
        target = _out_path(a.out)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(_dump(prof) + "\n", encoding="utf-8")
        except OSError as ex:
            raise UserError("cannot write '%s': %s" % (a.out, ex.strerror or ex))
        saved = "Saved: %s" % a.out
    if a.json:
        print(_dump(prof))
    else:
        print(render_voice(prof, saved))
    return 0


def cmd_match(a):
    voice = load_voice(a.voice)
    text = read_source(a.draft)
    res = match_voice(text, voice)
    if a.json:
        print(_dump(res))
    else:
        print(render_match(res, "<stdin>" if a.draft == "-" else a.draft, a.voice))
    return 1 if (a.strict and res["differences"]) else 0


def cmd_example(a):
    ex = load_examples()
    pairs = ex["pairs"]
    regs = ex.get("registers", {})
    if not a.register:
        rows = []
        for p in pairs:
            b, af, g = score_pair(p)
            rows.append({"id": p["id"], "register": p["register"], "title": p["title"], "before_score": b["score"], "after_score": af["score"]})
        if a.json:
            print(_dump({"registers": regs, "pairs": rows}))
        else:
            print("Registers: " + ", ".join(sorted(regs)))
            for r in rows:
                print("  %-22s %-13s %s (accent score %d -> %d)" % (r["id"], r["register"], r["title"], r["before_score"], r["after_score"]))
            print("Show one with: python3 scripts/tells.py example --register <name>")
        return 0
    chosen = [p for p in pairs if p["register"] == a.register]
    if not chosen:
        raise UserError("no example for register '%s'" % a.register)
    if a.json:
        out = []
        for p in chosen:
            b, af, g = score_pair(p)
            out.append(dict(p, before_score=b["score"], after_score=af["score"], facts_total=g["total"], facts_kept=g["kept"]))
        print(_dump(out))
        return 0
    for p in chosen:
        b, af, g = score_pair(p)
        print("[%s] %s (%s)" % (p["register"], p["title"], p["id"]))
        print("BEFORE (accent score %d, %s):" % (b["score"], b["band"]))
        print(_indent(p["before"]))
        print("AFTER (accent score %d, %s):" % (af["score"], af["band"]))
        print(_indent(p["after"]))
        print("What changed: %s" % p["changed"])
        print("Facts: %s\n" % facts_phrase(g))
    return 0


def _indent(s):
    return "\n".join("  " + line for line in s.splitlines())


def build_parser():
    ap = argparse.ArgumentParser(prog="tells.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--version", action="version", version="tells.py " + VERSION)
    sub = ap.add_subparsers(dest="cmd", metavar="{scan,compare,fingerprint,match,example}")
    sub.required = True
    p = sub.add_parser("scan", help="score the AI accent of a text and list the hits",
                       description="Score a text and list its tells.\n\n  python3 scripts/tells.py scan draft.txt\n  python3 scripts/tells.py scan - --json < draft.txt",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("file", help="text file, or - for stdin")
    p.add_argument("--json", action="store_true", help="machine-readable output (all hits unless --limit)")
    p.add_argument("--limit", type=int, default=None, help="max hits to list, worst first (default 30 as text, all as JSON; 0 = all)")
    p.add_argument("--formal", action="store_true", help="formal register: ignore contractions and long sentences")
    p.add_argument("--fail-above", type=int, default=None, metavar="N", help="exit 1 if the score is above N")
    p.set_defaults(func=cmd_scan)
    p = sub.add_parser("compare", help="score change plus fact guard between a draft and its rewrite",
                       description="Compare a rewrite with the original. Exit 1 if a number, date, time, link or handle was lost or invented.\n\n"
                                   "  python3 scripts/tells.py compare before.txt after.txt",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("before")
    p.add_argument("after")
    p.add_argument("--json", action="store_true")
    p.add_argument("--formal", action="store_true", help="formal register: ignore contractions and long sentences")
    p.set_defaults(func=cmd_compare)
    p = sub.add_parser("fingerprint", help="measure how a person writes from their samples",
                       description="Build a voice profile (measurements only, no sentences are stored) from writing samples.\n\n"
                                   "  python3 scripts/tells.py fingerprint mail1.txt mail2.txt --out voice.json",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("samples", nargs="+", help="one or more text files (or - for stdin)")
    p.add_argument("--out", metavar="FILE", help="write the profile here (inside the current directory unless absolute)")
    p.add_argument("--json", action="store_true", help="print the profile as JSON")
    p.set_defaults(func=cmd_fingerprint)
    p = sub.add_parser("match", help="compare a draft against a saved voice profile",
                       description="List concrete differences between a draft and a voice profile.\n\n"
                                   "  python3 scripts/tells.py match draft.txt --voice voice.json",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("draft")
    p.add_argument("--voice", required=True, metavar="voice.json")
    p.add_argument("--json", action="store_true")
    p.add_argument("--strict", action="store_true", help="exit 1 if any difference is found")
    p.set_defaults(func=cmd_match)
    p = sub.add_parser("example", help="show verified before/after pairs",
                       description="Show before/after pairs.\n\n  python3 scripts/tells.py example\n  python3 scripts/tells.py example --register email",
                       formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--register", choices=["email", "post", "bio", "letter", "blurb", "intro", "announcement", "sensitive"])
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_example)
    return ap


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    ap = build_parser()
    a = ap.parse_args(argv)
    try:
        return a.func(a)
    except UserError as ex:
        print("tells.py: %s" % ex, file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        sys.exit(0)
