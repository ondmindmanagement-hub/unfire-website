from pathlib import Path
import json
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "audio" / "narration-text" / "en.txt"
OUT = ROOT / "audio" / "narration-text"
PROGRESS = OUT / ".local-progress"

PROGRESS.mkdir(parents=True, exist_ok=True)

LANGS = {
    "ca": "Catalan from Catalonia",
    "is": "Icelandic",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "European Portuguese",
    "nl": "Dutch",
    "sv": "Swedish",
    "no": "Norwegian Bokmål",
    "da": "Danish",
    "fi": "Finnish",
    "pl": "Polish",
}

PROTECTED = [
    "Unfire",
    "Bolt",
    "Archer",
    "POWER",
    "AI TOKEN COUNTER",
]

def paragraphs():
    text = SRC.read_text(encoding="utf-8")

    return [
        re.sub(r"\s+", " ", x).strip()
        for x in re.split(r"\n\s*\n", text)
        if x.strip()
    ]

def ask_ollama(text, language):
    protected = ", ".join(PROTECTED)

    prompt = f"""
Translate the following website narration from English into {language}.

STRICT RULES:
- Return ONLY the translation.
- Do not explain anything.
- Do not add quotation marks.
- Preserve the meaning and professional corporate tone.
- Write natural native-level {language}, not literal machine translation.
- Never translate or alter these product names: {protected}.
- Keep numbers, technical terminology and product names accurate.
- This text will be spoken by a professional corporate female voice.

TEXT:
{text}
""".strip()

    body = json.dumps({
        "model": "qwen2.5:7b",
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.15
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:11434/api/generate",
        data=body,
        headers={"Content-Type": "application/json"}
    )

    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.loads(r.read().decode("utf-8"))

    return data["response"].strip()

def translate(lang, language):
    source = paragraphs()

    dest = OUT / f"{lang}.txt"
    progress_file = PROGRESS / f"{lang}.json"

    if dest.exists() and dest.stat().st_size > 1000:
        print(f"✓ {lang.upper()} ya terminado")
        return

    done = []

    if progress_file.exists():
        done = json.loads(
            progress_file.read_text(encoding="utf-8")
        )

    print("")
    print("=" * 48)
    print(f"→ {lang.upper()} · {language}")
    print(f"  {len(done)}/{len(source)} párrafos ya hechos")
    print("=" * 48)

    for i in range(len(done), len(source)):

        print(
            f"[{i+1}/{len(source)}] traduciendo...",
            flush=True
        )

        translated = ask_ollama(
            source[i],
            language
        )

        if not translated:
            raise RuntimeError(
                f"{lang}: respuesta vacía en {i+1}"
            )

        done.append(translated)

        progress_file.write_text(
            json.dumps(
                done,
                ensure_ascii=False,
                indent=2
            ),
            encoding="utf-8"
        )

        print(f"✓ {i+1}/{len(source)}")

    dest.write_text(
        "\n\n".join(done).strip() + "\n",
        encoding="utf-8"
    )

    print("")
    print(f"✓ {lang.upper()} TERMINADO")
    print(f"✓ {dest}")

requested = [
    x.lower()
    for x in sys.argv[1:]
]

if not requested:
    requested = ["ca", "is"]

for lang in requested:

    if lang not in LANGS:
        print("Idioma desconocido:", lang)
        continue

    translate(
        lang,
        LANGS[lang]
    )

print("")
print("==========================================")
print("✓ TRADUCCIÓN LOCAL COMPLETADA")
print("==========================================")
