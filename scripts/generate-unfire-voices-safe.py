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

# Voces que preferimos.
# Si una no existe en Edge, el script escogerá automáticamente
# otra voz FEMENINA del mismo idioma.
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

LANG_SEM = asyncio.Semaphore(2)

def split_text(text, limit=2200):
    """
    Divide conservando párrafos y evitando cortar frases
    siempre que sea posible.
    """
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
            current = ""

        # Párrafo excepcionalmente largo
        if len(p) > limit:
            sentences = re.split(r"(?<=[.!?])\s+", p)

            for sentence in sentences:
                candidate = (current + " " + sentence).strip()

                if len(candidate) <= limit:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                    current = sentence
        else:
            current = p

    if current:
        chunks.append(current)

    return chunks

async def available_voices():
    voices = await edge_tts.list_voices()
    return voices

def select_voice(lang, voices):
    locale, wanted = PREFERRED[lang]

    # Primero intentar exactamente la voz deseada
    for v in voices:
        if v.get("ShortName") == wanted:
            return wanted

    # Si no existe, cualquier voz femenina del locale exacto
    females = [
        v["ShortName"]
        for v in voices
        if v.get("Locale") == locale
        and str(v.get("Gender", "")).lower() == "female"
    ]

    if females:
        print(
            f"⚠ {lang.upper()}: {wanted} no disponible."
            f" Usando {females[0]}"
        )
        return females[0]

    raise RuntimeError(
        f"No encuentro una voz femenina para {lang} ({locale})"
    )

async def make_part(text, voice, destination):
    last_error = None

    for attempt in range(1, 6):
        try:
            if destination.exists():
                destination.unlink()

            communicate = edge_tts.Communicate(
                text=text,
                voice=voice,
                rate="-4%",
                pitch="-2Hz"
            )

            await communicate.save(str(destination))

            if destination.exists() and destination.stat().st_size > 1000:
                return

            raise RuntimeError("Microsoft devolvió un archivo vacío")

        except Exception as e:
            last_error = e

            print(
                f"    ↻ intento {attempt}/5: {type(e).__name__}"
            )

            await asyncio.sleep(attempt * 2)

    raise last_error

def combine_mp3(parts, output):
    ffmpeg = shutil.which("ffmpeg")

    if not ffmpeg:
        raise RuntimeError(
            "FFmpeg no está instalado"
        )

    listfile = output.parent / f".{output.stem}-concat.txt"

    listfile.write_text(
        "\n".join(
            "file '" + str(p.resolve()).replace("'", "'\\''") + "'"
            for p in parts
        ),
        encoding="utf-8"
    )

    subprocess.run(
        [
            ffmpeg,
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

async def generate_language(lang, voice):
    source = TEXT_DIR / f"{lang}.txt"
    output = OUT_DIR / f"unfire-master-{lang}.mp3"

    if not source.exists():
        print(f"○ {lang.upper()}: no existe {source.name}")
        return

    # El inglés ya está correcto: no regenerarlo.
    if output.exists() and output.stat().st_size > 100_000:
        print(
            f"✓ {lang.upper()}: ya existe "
            f"({output.stat().st_size / 1024 / 1024:.1f} MB)"
        )
        return

    async with LANG_SEM:
        text = source.read_text(encoding="utf-8").strip()
        chunks = split_text(text)

        lang_tmp = TMP_DIR / lang

        if lang_tmp.exists():
            shutil.rmtree(lang_tmp)

        lang_tmp.mkdir(parents=True)

        print("")
        print("========================================")
        print(f"→ {lang.upper()} · {voice}")
        print(f"  {len(chunks)} fragmentos")
        print("========================================")

        parts = []

        for i, chunk in enumerate(chunks, 1):
            part = lang_tmp / f"{i:03d}.mp3"

            print(
                f"  [{i}/{len(chunks)}] generando..."
            )

            await make_part(
                chunk,
                voice,
                part
            )

            parts.append(part)

            # Pequeña pausa para evitar bloqueo del servicio
            await asyncio.sleep(.45)

        combine_mp3(parts, output)

        if not output.exists() or output.stat().st_size < 10_000:
            raise RuntimeError(
                f"{lang}: master final inválido"
            )

        shutil.rmtree(lang_tmp)

        print(
            f"✓ {lang.upper()} TERMINADO · "
            f"{output.stat().st_size / 1024 / 1024:.1f} MB"
        )

async def main():
    voices = await available_voices()

    selected = {}

    print("")
    print("VOCES FEMENINAS SELECCIONADAS")
    print("----------------------------------------")

    for lang in PREFERRED:
        source = TEXT_DIR / f"{lang}.txt"

        if not source.exists():
            continue

        voice = select_voice(lang, voices)
        selected[lang] = voice
        print(f"{lang.upper():>3}  {voice}")

    print("")

    tasks = [
        generate_language(lang, voice)
        for lang, voice in selected.items()
    ]

    results = await asyncio.gather(
        *tasks,
        return_exceptions=True
    )

    errors = []

    for lang, result in zip(selected, results):
        if isinstance(result, Exception):
            errors.append((lang, result))

    print("")
    print("========================================")
    print("RESULTADO FINAL")
    print("========================================")

    for lang in selected:
        output = OUT_DIR / f"unfire-master-{lang}.mp3"

        if output.exists() and output.stat().st_size > 10_000:
            print(
                f"✓ {lang.upper()} "
                f"{output.stat().st_size / 1024 / 1024:.1f} MB"
            )
        else:
            print(f"✗ {lang.upper()}")

    if errors:
        print("")
        print("IDIOMAS CON ERROR:")

        for lang, err in errors:
            print(
                f"✗ {lang.upper()}: "
                f"{type(err).__name__}: {err}"
            )

asyncio.run(main())
