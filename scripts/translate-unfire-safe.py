from pathlib import Path
from deep_translator import GoogleTranslator
import json
import re
import time
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "audio" / "narration-text" / "en.txt"
OUT = ROOT / "audio" / "narration-text"
PROGRESS = OUT / ".translation-progress"

OUT.mkdir(parents=True, exist_ok=True)
PROGRESS.mkdir(parents=True, exist_ok=True)

LANGS = {
    "ca": "ca",
    "is": "is",
    "fr": "fr",
    "de": "de",
    "it": "it",
    "pt": "pt",
    "nl": "nl",
    "sv": "sv",
    "no": "no",
    "da": "da",
    "fi": "fi",
    "pl": "pl",
}

PROTECTED = {
    "AI TOKEN COUNTER": "ZXAITOKENCOUNTERXZ",
    "Unfire": "ZXUNFIREXZ",
    "Bolt": "ZXBOLTXZ",
    "Archer": "ZXARCHERXZ",
    "POWER": "ZXPOWERXZ",
}

def protect(s):
    for original, token in PROTECTED.items():
        s = s.replace(original, token)
    return s

def restore(s):
    for original, token in PROTECTED.items():
        s = s.replace(token, original)
    return s

def paragraphs():
    text = SRC.read_text(encoding="utf-8")
    return [
        re.sub(r"\s+", " ", p).strip()
        for p in re.split(r"\n\s*\n", text)
        if p.strip()
    ]

def make_batches(items, max_chars=2600):
    batches = []
    current = []
    total = 0

    for p in items:
        extra = len(p) + 40

        if current and total + extra > max_chars:
            batches.append(current)
            current = []
            total = 0

        current.append(p)
        total += extra

    if current:
        batches.append(current)

    return batches

def encode_batch(batch):
    chunks = []

    for i, p in enumerate(batch):
        chunks.append(
            f"[[[P{i:03d}]]]\n{protect(p)}"
        )

    return "\n\n".join(chunks)

def decode_batch(text, expected):
    pattern = re.compile(
        r"\[\[\[P(\d{3})\]\]\]\s*(.*?)(?=\n\s*\[\[\[P\d{3}\]\]\]|\Z)",
        re.S
    )

    found = pattern.findall(text)

    if len(found) != expected:
        raise RuntimeError(
            f"Esperaba {expected} párrafos y recibí {len(found)}"
        )

    result = []

    for number, content in found:
        result.append(
            restore(content.strip())
        )

    return result

def load_progress(lang):
    f = PROGRESS / f"{lang}.json"

    if not f.exists():
        return []

    return json.loads(
        f.read_text(encoding="utf-8")
    )

def save_progress(lang, translated):
    f = PROGRESS / f"{lang}.json"

    f.write_text(
        json.dumps(
            translated,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

def translate_language(lang, target, source_paragraphs):

    dest = OUT / f"{lang}.txt"

    if dest.exists() and dest.stat().st_size > 1000:
        print(f"✓ {lang.upper()} ya existe")
        return True

    batches = make_batches(source_paragraphs)

    translated = load_progress(lang)

    already = len(translated)

    print("")
    print("==========================================")
    print(f"→ {lang.upper()}")
    print(f"  {len(source_paragraphs)} párrafos")
    print(f"  {len(batches)} peticiones grandes")
    print(f"  {already} párrafos ya guardados")
    print("==========================================")

    consumed = 0

    for batch_number, batch in enumerate(batches, 1):

        start = consumed
        end = consumed + len(batch)
        consumed = end

        if already >= end:
            print(
                f"✓ bloque {batch_number}/{len(batches)} ya estaba hecho"
            )
            continue

        payload = encode_batch(batch)

        success = False

        for attempt in range(1, 8):

            try:
                print(
                    f"→ bloque {batch_number}/{len(batches)} "
                    f"· intento {attempt}"
                )

                translator = GoogleTranslator(
                    source="en",
                    target=target
                )

                result = translator.translate(payload)

                decoded = decode_batch(
                    result,
                    len(batch)
                )

                # Si había progreso parcial anterior,
                # sustituimos desde el inicio de este lote.
                translated = translated[:start] + decoded

                save_progress(
                    lang,
                    translated
                )

                print(
                    f"✓ bloque {batch_number}/{len(batches)}"
                )

                success = True

                # Evitar otro 429
                time.sleep(12)

                break

            except Exception as e:

                name = type(e).__name__

                wait = min(
                    30 * attempt,
                    180
                )

                print(
                    f"⚠ {name}: esperando {wait}s..."
                )

                time.sleep(wait)

        if not success:
            print("")
            print(
                f"✗ {lang.upper()} detenido, "
                "pero el progreso queda guardado."
            )
            return False

    if len(translated) != len(source_paragraphs):
        print(
            f"✗ {lang.upper()}: "
            f"{len(translated)}/{len(source_paragraphs)} párrafos"
        )
        return False

    dest.write_text(
        "\n\n".join(translated).strip() + "\n",
        encoding="utf-8"
    )

    print("")
    print(
        f"✓ {lang.upper()} TERMINADO · "
        f"{len(translated)} párrafos"
    )

    return True


if not SRC.exists():
    raise SystemExit(
        "ERROR: falta audio/narration-text/en.txt"
    )

source_paragraphs = paragraphs()

# Puedes pasar idiomas concretos:
# python3 scripts/translate-unfire-safe.py ca is
requested = [
    x.lower()
    for x in sys.argv[1:]
]

if requested:
    selected = {
        k:v
        for k,v in LANGS.items()
        if k in requested
    }
else:
    selected = LANGS

print("")
print("UNFIRE SAFE TRANSLATOR")
print("------------------------------------------")
print(
    "Idiomas:",
    ", ".join(x.upper() for x in selected)
)
print(
    "Párrafos master:",
    len(source_paragraphs)
)
print("")

for lang, target in selected.items():

    ok = translate_language(
        lang,
        target,
        source_paragraphs
    )

    if not ok:
        print("")
        print(
            "Puedes volver a ejecutar exactamente "
            "el mismo comando más tarde."
        )
        sys.exit(2)

    # Descanso entre idiomas
    print("Pausa 30s antes del siguiente idioma...")
    time.sleep(30)

print("")
print("==========================================")
print("✓ TRADUCCIONES TERMINADAS")
print("==========================================")
