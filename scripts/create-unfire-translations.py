from pathlib import Path
from deep_translator import GoogleTranslator
import re
import time
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "audio" / "narration-text" / "en.txt"
OUT = ROOT / "audio" / "narration-text"

if not SRC.exists():
    raise SystemExit("ERROR: falta audio/narration-text/en.txt")

OUT.mkdir(parents=True, exist_ok=True)

text = SRC.read_text(encoding="utf-8").strip()

paragraphs = [
    re.sub(r"\s+", " ", p).strip()
    for p in re.split(r"\n\s*\n", text)
    if p.strip()
]

languages = {
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

# Tokens difíciles de traducir accidentalmente
PROTECTED = {
    "Unfire": "ZXUNFIREXZ",
    "Bolt": "ZXBOLTXZ",
    "Archer": "ZXARCHERXZ",
    "POWER": "ZXPOWERXZ",
    "AI TOKEN COUNTER": "ZXAITOKENCOUNTERXZ",
}

def protect(s):
    for original, token in PROTECTED.items():
        s = s.replace(original, token)
    return s

def restore(s):
    for original, token in PROTECTED.items():
        s = s.replace(token, original)
    return s

print("")
print("==========================================")
print("UNFIRE — CREANDO 12 IDIOMAS")
print("==========================================")
print(f"Master inglés: {len(paragraphs)} bloques")
print("")

failed = []

for lang, target in languages.items():

    dest = OUT / f"{lang}.txt"

    if dest.exists() and dest.stat().st_size > 1000:
        print(f"✓ {lang.upper()}: ya existe")
        continue

    print("")
    print("------------------------------------------")
    print(f"→ {lang.upper()}")
    print("------------------------------------------")

    output = []

    for n, paragraph in enumerate(paragraphs, 1):

        translated = None

        for attempt in range(1, 6):
            try:
                translated = GoogleTranslator(
                    source="en",
                    target=target
                ).translate(
                    protect(paragraph)
                )

                if not translated:
                    raise RuntimeError("respuesta vacía")

                translated = restore(translated)
                break

            except Exception as e:
                print(
                    f"  ↻ bloque {n}/{len(paragraphs)} "
                    f"intento {attempt}/5 · {type(e).__name__}"
                )
                time.sleep(attempt * 2)

        if translated is None:
            failed.append(lang)
            print(f"✗ {lang.upper()}: error en bloque {n}")
            break

        output.append(translated)

        print(
            f"  ✓ {n}/{len(paragraphs)}",
            flush=True
        )

        time.sleep(.25)

    if len(output) == len(paragraphs):
        dest.write_text(
            "\n\n".join(output).strip() + "\n",
            encoding="utf-8"
        )

        print(
            f"✓ {lang.upper()} TERMINADO · "
            f"{dest.stat().st_size / 1024:.0f} KB"
        )

print("")
print("==========================================")
print("VERIFICACIÓN")
print("==========================================")

missing = []

for lang in languages:
    f = OUT / f"{lang}.txt"

    if f.exists() and f.stat().st_size > 1000:
        words = len(f.read_text(encoding="utf-8").split())
        print(f"✓ {lang.upper():>2} · {words} palabras")
    else:
        print(f"✗ {lang.upper():>2} · FALTA")
        missing.append(lang)

if missing:
    print("")
    print("FALTAN:", ", ".join(x.upper() for x in missing))
    sys.exit(2)

print("")
print("✓ LOS 12 IDIOMAS ESTÁN LISTOS")
