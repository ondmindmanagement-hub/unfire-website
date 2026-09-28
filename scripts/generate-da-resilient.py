import asyncio
import re
import shutil
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path.cwd()
TEXT = ROOT / "audio/narration-text/da.txt"
OUT = ROOT / "audio/masters/unfire-master-da.mp3"
CACHE = ROOT / "audio/masters/.da-parts"

VOICE = "da-DK-ChristelNeural"
MAX_CHARS = 280
MAX_RETRIES = 12

CACHE.mkdir(parents=True, exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)

text = TEXT.read_text(encoding="utf-8").strip()

def chunks_from_text(text, max_chars=280):
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(sentence) > max_chars:
            words = sentence.split()
            piece = ""
            for word in words:
                candidate = f"{piece} {word}".strip()
                if len(candidate) <= max_chars:
                    piece = candidate
                else:
                    if piece:
                        chunks.append(piece)
                    piece = word
            if piece:
                if current:
                    chunks.append(current)
                    current = ""
                chunks.append(piece)
            continue

        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)

    return chunks

chunks = chunks_from_text(text, MAX_CHARS)

async def make_part(i, chunk):
    part = CACHE / f"{i:03d}.mp3"

    if part.exists() and part.stat().st_size > 1000:
        print(f"✓ [{i}/{len(chunks)}] ya existe")
        return part

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"→ [{i}/{len(chunks)}] intento {attempt}/{MAX_RETRIES}")
            communicate = edge_tts.Communicate(
                chunk,
                VOICE,
                rate="+0%",
                volume="+0%",
                pitch="+0Hz",
            )
            await communicate.save(str(part))

            if part.exists() and part.stat().st_size > 1000:
                print(f"  ✓ {part.stat().st_size / 1024:.0f} KB")
                await asyncio.sleep(4)
                return part

        except Exception as e:
            print(f"  ↻ {type(e).__name__}: {e}")

        if part.exists():
            part.unlink()

        wait = min(8 + attempt * 4, 45)
        print(f"  esperando {wait}s...")
        await asyncio.sleep(wait)

    raise RuntimeError(f"No se pudo generar fragmento {i}")

async def main():
    print("========================================")
    print("DANÉS · GENERACIÓN RESILIENTE")
    print("========================================")
    print(f"Voz: {VOICE}")
    print(f"Fragmentos: {len(chunks)}")
    print(f"Máximo: {MAX_CHARS} caracteres")
    print("")

    parts = []

    for i, chunk in enumerate(chunks, 1):
        part = await make_part(i, chunk)
        parts.append(part)

    concat_file = CACHE / "concat.txt"
    concat_file.write_text(
        "".join(f"file '{p.resolve()}'\n" for p in parts),
        encoding="utf-8"
    )

    print("")
    print("→ Uniendo audio...")

    ffmpeg = shutil.which("ffmpeg")

    if ffmpeg:
        subprocess.run([
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel", "error",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy",
            str(OUT),
        ], check=True)
    else:
        # Fallback si ffmpeg no está instalado.
        with OUT.open("wb") as dest:
            for part in parts:
                dest.write(part.read_bytes())

    print("")
    print("========================================")
    print(f"✓ DA TERMINADO · {OUT.stat().st_size/1024/1024:.1f} MB")
    print("========================================")

asyncio.run(main())
