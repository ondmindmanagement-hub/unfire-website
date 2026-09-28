import asyncio
import json
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
TEXT_DIR = ROOT / "audio" / "narration-text"
OUT_DIR = ROOT / "audio" / "masters"
VOICE_MAP = ROOT / "audio" / "voice-map.json"

OUT_DIR.mkdir(parents=True, exist_ok=True)

voices = json.loads(
    VOICE_MAP.read_text(encoding="utf-8")
)

SEM = asyncio.Semaphore(5)

async def generate(lang, voice):
    source = TEXT_DIR / f"{lang}.txt"
    dest = OUT_DIR / f"unfire-master-{lang}.mp3"

    if dest.exists() and dest.stat().st_size > 10000:
        print(f"✓ {lang}: ya existe")
        return

    if not source.exists():
        print(f"○ {lang}: falta texto")
        return

    text = source.read_text(encoding="utf-8").strip()

    if not text:
        print(f"○ {lang}: vacío")
        return

    async with SEM:
        print(f"→ {lang}: {voice}")

        tts = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate="-4%",
            pitch="-2Hz"
        )

        await tts.save(str(dest))

        print(f"✓ {lang}: terminado")

async def main():
    await asyncio.gather(
        *[
            generate(lang, voice)
            for lang, voice in voices.items()
        ],
        return_exceptions=False
    )

asyncio.run(main())
