import asyncio
import re
import shutil
import subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "audio" / "narration-text" / "da.txt"
OUT = ROOT / "audio" / "masters" / "unfire-master-da.mp3"
TMP = ROOT / "audio" / "masters" / "_parts_da"

VOICE = "da-DK-ChristelNeural"

def split_text(text, limit=1200):
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks = []
    current = ""

    for p in paragraphs:
        candidate = (current + "\n\n" + p).strip()

        if len(candidate) <= limit:
            current = candidate
        else:
            if current:
                chunks.append(current)

            if len(p) <= limit:
                current = p
            else:
                sentences = re.split(r'(?<=[.!?])\s+', p)
                current = ""
                for s in sentences:
                    c = (current + " " + s).strip()
                    if len(c) <= limit:
                        current = c
                    else:
                        if current:
                            chunks.append(current)
                        current = s

    if current:
        chunks.append(current)

    return chunks

def combine(parts, output):
    listfile = output.parent / ".da-concat.txt"
    listfile.write_text(
        "\n".join(f"file '{p.resolve()}'" for p in parts),
        encoding="utf-8"
    )

    subprocess.run([
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(listfile),
        "-c", "copy",
        str(output)
    ], check=True)

    listfile.unlink(missing_ok=True)

async def main():
    text = SRC.read_text(encoding="utf-8").strip()
    chunks = split_text(text)

    if TMP.exists():
        shutil.rmtree(TMP)

    TMP.mkdir(parents=True)

    print(f"DA · {len(chunks)} fragmentos pequeños")
    parts = []

    for i, chunk in enumerate(chunks, 1):
        part = TMP / f"{i:03d}.mp3"

        print(f"[{i}/{len(chunks)}]")

        ok = False

        for attempt in range(1, 8):
            try:
                tts = edge_tts.Communicate(
                    text=chunk,
                    voice=VOICE,
                    rate="-4%",
                    pitch="-2Hz"
                )

                await tts.save(str(part))

                if part.exists() and part.stat().st_size > 1000:
                    ok = True
                    break

            except Exception as e:
                print(f"  intento {attempt}/7 · {type(e).__name__}")
                await asyncio.sleep(attempt * 5)

        if not ok:
            raise RuntimeError(f"falló fragmento {i}")

        parts.append(part)
        await asyncio.sleep(1)

    combine(parts, OUT)
    shutil.rmtree(TMP)

    print("")
    print(f"✓ DA TERMINADO · {OUT.stat().st_size/1024/1024:.1f} MB")

asyncio.run(main())
