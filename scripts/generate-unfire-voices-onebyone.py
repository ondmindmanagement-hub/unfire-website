import asyncio
import json
import re
import shutil
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
TEXT_DIR = ROOT / "audio" / "narration-text"
OUT_DIR = ROOT / "audio" / "masters"
TMP_DIR = OUT_DIR / "_parts"

OUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

PREFERRED = {
    "en": ("en-GB", "en-GB-SoniaNeural"),
    "es": ("es-ES", "es-ES-ElviraNeural"),
    "ca": ("ca-ES", "ca-ES-AlbaNeural"),
    "is": ("is-IS", "is-IS-GudrunNeural"),
    "fr": ("fr-FR", "fr-FR-DeniseNeural"),
    "de": ("de-DE", "de-DE-SeraphinaMultilingualNeural"),
    "it": ("it-IT", "it-IT-ElsaNeural"),
    "pt": ("pt-PT", "pt-PT-RaquelNeural"),
    "nl": ("nl-NL", "nl-NL-ColetteNeural"),
    "sv": ("sv-SE", "sv-SE-SofieNeural"),
    "no": ("nb-NO", "nb-NO-PernilleNeural"),
    "da": ("da-DK", "da-DK-ChristelNeural"),
    "fi": ("fi-FI", "fi-FI-SelmaNeural"),
    "pl": ("pl-PL", "pl-PL-ZofiaNeural"),
}

def split_text(text, limit=2200):
    paragraphs = [
        p.strip()
        for p in re.split(r"\n\s*\n", text)
        if p.strip()
    ]

    chunks = []
    current = ""

    for p in paragraphs:
        candidate = (current + "\n\n" + p).strip()

        if len(candidate) <= limit:
            current = candidate
            continue

        if current:
            chunks.append(current)

        current = p

    if current:
        chunks.append(current)

    return chunks

def combine(parts, output):
    listfile = output.parent / f".{output.stem}-concat.txt"

    listfile.write_text(
        "\n".join(
            f"file '{p.resolve()}'"
            for p in parts
        ),
        encoding="utf-8"
    )

    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(listfile),
            "-c", "copy",
            str(output)
        ],
        check=True
    )

    listfile.unlink(missing_ok=True)

async def get_voice(lang):
    locale, preferred = PREFERRED[lang]

    voices = await edge_tts.list_voices()

    for v in voices:
        if v.get("ShortName") == preferred:
            return preferred

    females = [
        v["ShortName"]
        for v in voices
        if v.get("Locale") == locale
        and str(v.get("Gender", "")).lower() == "female"
    ]

    if females:
        print(
            f"⚠ {preferred} no disponible; "
            f"usando {females[0]}"
        )
        return females[0]

    raise RuntimeError(
        f"No encuentro voz femenina para {lang}"
    )

async def generate(lang):

    source = TEXT_DIR / f"{lang}.txt"
    output = OUT_DIR / f"unfire-master-{lang}.mp3"

    if output.exists() and output.stat().st_size > 100000:
        print(
            f"✓ {lang.upper()} ya existe · "
            f"{output.stat().st_size/1024/1024:.1f} MB"
        )
        return

    if not source.exists():
        print(f"○ {lang.upper()} falta texto")
        return

    voice = await get_voice(lang)

    text = source.read_text(
        encoding="utf-8"
    ).strip()

    chunks = split_text(text)

    work = TMP_DIR / lang

    if work.exists():
        shutil.rmtree(work)

    work.mkdir(parents=True)

    print("")
    print("========================================")
    print(f"→ {lang.upper()} · {voice}")
    print(f"  {len(chunks)} fragmentos")
    print("========================================")

    parts = []

    for i, chunk in enumerate(chunks, 1):

        part = work / f"{i:03d}.mp3"

        print(
            f"  [{i}/{len(chunks)}] generando..."
        )

        success = False

        for attempt in range(1, 6):

            try:
                communicate = edge_tts.Communicate(
                    text=chunk,
                    voice=voice,
                    rate="-4%",
                    pitch="-2Hz"
                )

                await communicate.save(
                    str(part)
                )

                if (
                    part.exists()
                    and part.stat().st_size > 1000
                ):
                    success = True
                    break

            except Exception as e:

                print(
                    f"    ↻ intento {attempt}/5 "
                    f"· {type(e).__name__}"
                )

                await asyncio.sleep(
                    attempt * 3
                )

        if not success:
            raise RuntimeError(
                f"{lang}: falló fragmento {i}"
            )

        parts.append(part)

        await asyncio.sleep(.5)

    combine(parts, output)

    shutil.rmtree(work)

    print(
        f"✓ {lang.upper()} TERMINADO · "
        f"{output.stat().st_size/1024/1024:.1f} MB"
    )

# IMPORTANTE:
# Cada idioma usa SU PROPIO asyncio.run()
# para evitar "different loop".

remaining = [
    "it",
    "pt",
    "nl",
    "sv",
    "no",
    "da",
    "fi",
    "pl",
]

for lang in remaining:

    try:
        asyncio.run(
            generate(lang)
        )

    except Exception as e:

        print("")
        print(
            f"✗ {lang.upper()}: "
            f"{type(e).__name__}: {e}"
        )

print("")
print("========================================")
print("MASTERS DISPONIBLES")
print("========================================")

for lang in PREFERRED:

    f = OUT_DIR / f"unfire-master-{lang}.mp3"

    if f.exists() and f.stat().st_size > 10000:

        print(
            f"✓ {lang.upper():>2} "
            f"{f.stat().st_size/1024/1024:.1f} MB"
        )

    else:

        print(
            f"○ {lang.upper():>2}"
        )
