#!/usr/bin/env python3

import json
import re
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
TEXT = AUDIO / "narration-text"

LANGS = ["ca","is","fr","de","nl","no","da","fi","pl"]

WHISPER_LANG = {
    "ca":"ca",
    "is":"is",
    "fr":"fr",
    "de":"de",
    "it":"it",
    "pt":"pt",
    "nl":"nl",
    "sv":"sv",
    "no":"no",
    "da":"da",
    "fi":"fi",
    "pl":"pl",
}

def norm(s):
    s = unicodedata.normalize("NFKC", s).lower()
    s = re.sub(r"[^\wÀ-ÿĀ-žÆØÅæøåÞþÐð]+", "", s, flags=re.UNICODE)
    return s

def canonical_blocks(text):
    # Conserva párrafos/líneas como bloques canónicos.
    lines = []
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            lines.append(line)
    return lines

def split_words(s):
    return re.findall(r"\S+", s)

def duration(path):
    p = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path)
        ],
        capture_output=True, text=True, check=True
    )
    return float(p.stdout.strip())

def transcribe_mlx(audio_path, lang):
    import mlx_whisper

    result = mlx_whisper.transcribe(
        str(audio_path),
        path_or_hf_repo="mlx-community/whisper-large-v3-mlx",
        language=WHISPER_LANG[lang],
        word_timestamps=True,
        verbose=False,
    )

    words = []

    for seg in result.get("segments", []):
        for w in seg.get("words", []) or []:
            txt = str(w.get("word", "")).strip()
            if not txt:
                continue

            st = w.get("start")
            en = w.get("end")

            if st is None or en is None:
                continue

            words.append({
                "word": txt,
                "start": float(st),
                "end": float(en)
            })

    return words

def align(canon_words, transcript):
    c_norm = [norm(x) for x in canon_words]
    t_norm = [norm(x["word"]) for x in transcript]

    matcher = SequenceMatcher(None, c_norm, t_norm, autojunk=False)

    mapping = {}
    exact = set()

    for block in matcher.get_matching_blocks():
        for j in range(block.size):
            ci = block.a + j
            ti = block.b + j
            mapping[ci] = ti
            if c_norm[ci] and c_norm[ci] == t_norm[ti]:
                exact.add(ci)

    # Rellenar palabras canónicas no emparejadas interpolando
    # entre timestamps vecinos.
    out = []

    for i, word in enumerate(canon_words):
        if i in mapping:
            tw = transcript[mapping[i]]
            out.append({
                "word": word,
                "start": float(tw["start"]),
                "end": float(tw["end"]),
                "exact": i in exact,
            })
            continue

        prev_i = i - 1
        while prev_i >= 0 and prev_i not in mapping:
            prev_i -= 1

        next_i = i + 1
        while next_i < len(canon_words) and next_i not in mapping:
            next_i += 1

        if prev_i >= 0:
            left = transcript[mapping[prev_i]]["end"]
        elif transcript:
            left = transcript[0]["start"]
        else:
            left = 0.0

        if next_i < len(canon_words):
            right = transcript[mapping[next_i]]["start"]
        elif transcript:
            right = transcript[-1]["end"]
        else:
            right = left + 0.25

        run_start = prev_i + 1
        run_end = next_i
        run_count = max(1, run_end - run_start)

        pos = i - run_start
        span = max(0.04, right - left)

        st = left + span * (pos / run_count)
        en = left + span * ((pos + 1) / run_count)

        out.append({
            "word": word,
            "start": float(st),
            "end": float(max(st + 0.02, en)),
            "exact": False,
        })

    return out, len(exact)

def build(lang):
    mp3 = AUDIO / "masters" / f"unfire-master-{lang}.mp3"

    # Compatibilidad con la ubicación usada por EN/ES.
    if not mp3.exists():
        alt = AUDIO / f"unfire-master-{lang}.mp3"
        if alt.exists():
            mp3 = alt

    txt_path = TEXT / f"{lang}.txt"
    out_path = AUDIO / f"unfire-master-{lang}.canonical.json"

    if not mp3.exists():
        raise FileNotFoundError(f"Audio no encontrado: {mp3}")

    if not txt_path.exists():
        raise FileNotFoundError(f"Texto no encontrado: {txt_path}")

    text = txt_path.read_text(encoding="utf-8").strip()
    blocks_text = canonical_blocks(text)

    all_words = []
    block_ranges = []

    for bi, block in enumerate(blocks_text):
        ws = split_words(block)
        start = len(all_words)
        all_words.extend(ws)
        end = len(all_words)
        block_ranges.append((bi, block, start, end))

    print(f"\n========================================")
    print(f"{lang.upper()} · {len(all_words)} palabras")
    print(f"========================================")
    print("→ Transcribiendo audio con timestamps reales...")

    transcript = transcribe_mlx(mp3, lang)

    if not transcript:
        raise RuntimeError("Whisper no devolvió palabras")

    print(f"→ Whisper: {len(transcript)} palabras")

    words, exact_matches = align(all_words, transcript)

    # Asignar bloque a cada palabra.
    word_to_block = {}
    for bi, _, s, e in block_ranges:
        for wi in range(s, e):
            word_to_block[wi] = bi

    for i, w in enumerate(words):
        w["block"] = word_to_block.get(i, 0)

    blocks = []
    for bi, text_block, s, e in block_ranges:
        if s < len(words) and e > s:
            start = words[s]["start"]
            end = words[min(e - 1, len(words) - 1)]["end"]
        else:
            start = end = 0.0

        blocks.append({
            "index": bi,
            "text": text_block,
            "word_start": s,
            "word_end": e,
            "start": float(start),
            "end": float(end),
        })

    dur = duration(mp3)
    coverage = exact_matches / max(1, len(all_words))

    data = {
        "language": lang,
        "audio_duration": dur,
        "canonical_blocks": len(blocks),
        "canonical_words": len(all_words),
        "transcript_words": len(transcript),
        "exact_matches": exact_matches,
        "coverage": coverage,
        "blocks": blocks,
        "words": words,
    }

    out_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"✓ {out_path.name}")
    print(f"  duración: {dur:.2f}s")
    print(f"  bloques: {len(blocks)}")
    print(f"  canonical: {len(all_words)}")
    print(f"  transcript: {len(transcript)}")
    print(f"  exactos: {exact_matches}")
    print(f"  cobertura: {coverage:.1%}")

    return coverage

def main():
    try:
        import mlx_whisper
    except ImportError:
        print("FALTA mlx-whisper")
        print("")
        print("Ejecuta:")
        print("python3 -m pip install --user mlx-whisper")
        sys.exit(2)

    results = {}

    for lang in LANGS:
        try:
            results[lang] = build(lang)
        except Exception as exc:
            print(f"\n✗ {lang.upper()}: {exc}")
            results[lang] = None

    print("\n")
    print("========== RESULTADO ==========")

    good = 0

    for lang in LANGS:
        cov = results[lang]
        if cov is None:
            print(f"✗ {lang} ERROR")
        elif cov >= 0.90:
            good += 1
            print(f"✓ {lang} {cov:.1%}")
        elif cov >= 0.80:
            print(f"⚠ {lang} {cov:.1%}")
        else:
            print(f"✗ {lang} {cov:.1%}")

    print("")
    print(f"Timelines >=90%: {good}/{len(LANGS)}")

if __name__ == "__main__":
    main()
