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

async def generate(lang, voice):
    source = TEXT_DIR / f"{lang}.txt"

    if not source.exists():
        print(f"○ {lang}: falta {source.name}")
        return

    text = source.read_text(encoding="utf-8").strip()

    if not text:
        print(f"○ {lang}: texto vacío")
        return

    dest = OUT_DIR / f"unfire-master-{lang}.mp3"

    print(f"→ {lang}: {voice}")

    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate="-4%",
        pitch="-2Hz"
    )

    await communicate.save(str(dest))

    print(f"✓ {dest.name}")

async def main():
    for lang, voice in voices.items():
        try:
            await generate(lang, voice)
        except Exception as e:
            print(f"✗ {lang}: {e}")

asyncio.run(main())
