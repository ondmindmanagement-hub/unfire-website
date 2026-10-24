#!/usr/bin/env python3
"""Private Unfire review cuts. ALL visuals from tracked Unfire gameplay source assets.
Never publishes to Pages, YouTube or a release. Requires ffmpeg, ffprobe, espeak-ng.
"""
from pathlib import Path
import json
import shlex
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=HERE/"output"
WORK=OUT/"work"
WORK.mkdir(parents=True,exist_ok=True)
CAP=ROOT/"audio/press/captures"
SRC=ROOT/"audio/media/UNFIRE_MUTANTS_EP01_SHORT_ES.mp4"
MUSIC=ROOT/"audio/media/songs/s07.mp3"  # DRAGONS - UK Bass Waves (metadata listing).
FPS=30
W,H=1280,720

def run(cmd):
    print("$"," ".join(shlex.quote(str(x)) for x in cmd),flush=True)
    subprocess.run([str(x) for x in cmd],check=True)

def probe(path):
    return json.loads(subprocess.check_output(["ffprobe","-v","error","-show_entries",
      "format=duration:stream=index,codec_type,width,height,avg_frame_rate",
      "-of","json",str(path)],text=True))

def video_length(path):
    return float(probe(path)["format"]["duration"])

assert SRC.is_file() and MUSIC.is_file(), "Real recorded clip or music is missing."
assert all((CAP/x).is_file() for x in (
    "09-night-flight-panorama.jpg","06-sky-flight-sunset.jpg",
    "05-sky-flight-day.jpg","03-house-exterior.jpg",
    "01-inside-house.jpg","04-island-exploration.jpg")), "Missing original gameplay screenshots."
assert (ROOT/"audio/media/songs/list.json").is_file()
songlist=json.loads((ROOT/"audio/media/songs/list.json").read_text())
assert any(s["f"]=="s07.mp3" and s["a"]=="UK Bass Waves" for s in songlist)
src_len=video_length(SRC)
print("Original filmed game clip:",src_len,"seconds.")

# This preview deliberately does NOT reconstruct missing 3D shots or manufacture
# playable footage. Moving shot is taken from an existing genuine game recording.
def still(filename,sec,n):
    target=WORK/f"shot_{n:02d}.mp4"
    vf=("scale=1400:788:force_original_aspect_ratio=increase,"
        "crop=1400:788,"
        "zoompan=z='min(zoom+0.00048,1.075)':"
        "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d=1:s={W}x{H}:fps={FPS},format=yuv420p")
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",str(FPS),
      "-loop","1","-i",CAP/filename,"-t",str(sec),"-vf",vf,
      "-an","-c:v","libx264","-preset","veryfast","-crf","21","-r",str(FPS),
      "-pix_fmt","yuv420p",target])
    return target

def recorded(sec,n,start=0):
    target=WORK/f"shot_{n:02d}.mp4"
    seek=min(start,max(0,src_len-sec-0.15))
    # Native real moving gameplay is framed on an out-of-focus duplicate of
    # itself, NOT falsely widened, synthesized or passed off as a new camera.
    vf=(f"[0:v]split=2[bg][fg];"
        f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,"
        f"crop={W}:{H},boxblur=20:4[back];"
        f"[fg]scale=-2:{H}[front];"
        f"[back][front]overlay=(W-w)/2:(H-h)/2,"
        f"fps={FPS},format=yuv420p[v]")
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",str(seek),
      "-i",SRC,"-t",str(sec),"-filter_complex",vf,"-map","[v]","-an",
      "-c:v","libx264","-preset","veryfast","-crf","21","-r",str(FPS),
      "-pix_fmt","yuv420p",target])
    return target

# Deliberately mostly exterior, island skies and night; the house interior is
# NOT the focus. Night panoramas do not claim to show every island at once.
scenes=[
  ("night",6,"09-night-flight-panorama.jpg"),
  ("movie",5,0),
  ("exterior",5,"03-house-exterior.jpg"),
  ("sky",5,"06-sky-flight-sunset.jpg"),
  ("aerial",6,"05-sky-flight-day.jpg"),
  ("island",5,"04-island-exploration.jpg"),
  ("movie",5,6.5),
  ("night",7,"09-night-flight-panorama.jpg")
]
parts=[]
for n,(kind,seconds,asset) in enumerate(scenes):
    parts.append(recorded(seconds,n,asset) if kind=="movie" else still(asset,seconds,n))
total=sum(s[1] for s in scenes)
listing=WORK/"concat.txt"
listing.write_text("".join("file '"+str(p.resolve()).replace("'","'\\''")+"'\n" for p in parts))
silent=WORK/"trailer-silent.mp4"
run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat",
  "-safe","0","-i",listing,"-c","copy",silent])

# A theatrical mystery-comedy in ES; no alleged footage of an unrecorded
# character or mission, and no imitation of any named film or franchise.
lines=[
 (1.1,"es+m3",40,138,"Las islas parecían estar tranquilas..."),
 (6.6,"es+f2",68,170,"¿Quién ha tocado otra vez el maletín?"),
 (12.1,"es+m3",30,133,"Yo no. Solo he pulsado el botón azul."),
 (17.6,"es+f2",75,180,"¡EL BOTÓN AZUL! ¿EN SERIO?"),
 (23.5,"es+m3",38,142,"No hay marcha atrás. Vamos a explorar."),
 (29.4,"es+f2",70,160,"Vale. Pero yo no conduzco esa cosa."),
 (36.1,"es+m3",42,135,"Unfire Mutants. El mundo te espera.")
]
inputs=["-i",MUSIC]
filters=[f"[0:a]atrim=duration={total},asetpts=PTS-STARTPTS,volume=0.20[m]"]
voices=[]
for idx,(at,voice,pitch,speed,speech) in enumerate(lines,1):
    wav=WORK/f"robot_{idx:02d}.wav"
    run(["espeak-ng","-v",voice,"-p",str(pitch),"-s",str(speed),
      "-a","175","-w",wav,speech])
    inputs+=["-i",wav]
    delay=int(at*1000)
    filters.append(f"[{idx}:a]volume=1.5,adelay={delay}|{delay}[v{idx}]")
    voices.append(f"[v{idx}]")
filters.append("[m]"+"".join(voices)+f"amix=inputs={len(lines)+1}:duration=first:normalize=0,"
               "acompressor=threshold=-16dB:ratio=3:attack=10:release=150,"
               "alimiter=limit=0.9[a]")
mix=WORK/"trailer-audio.wav"
run(["ffmpeg","-hide_banner","-loglevel","error","-y",*inputs,
  "-filter_complex",";".join(filters),"-map","[a]","-t",str(total),
  "-ar","48000","-ac","2",mix])

def stamp(seconds):
    h=int(seconds)//3600;m=(int(seconds)//60)%60;s=int(seconds)%60;ms=int((seconds-int(seconds))*1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

# Caption what voices really say. No subtitles announcing non-existent places.
srt=WORK/"trailer-es.srt"
srt.write_text("\n\n".join(
    f"{i}\n{stamp(at)} --> {stamp(min(at+3.4,total-.1))}\n{text}"
    for i,(at,_,_,_,text) in enumerate(lines,1))+"\n",encoding="utf-8")
trailer=OUT/"UNFIRE_TRAILER_HISTORIA_REVISION_ES.mp4"
run(["ffmpeg","-hide_banner","-loglevel","error","-y",
  "-i",silent,"-i",mix,"-filter_complex",
  "[0:v]drawtext=text='UNFIRE  |  PREVIEW PRIVADA':fontsize=15:fontcolor=white@0.8:"
  "x=35:y=30:box=1:boxcolor=black@0.35,"
  "subtitles='"+str(srt)+"':force_style='FontName=DejaVu Sans,"
  "FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
  "BorderStyle=1,Outline=2,Shadow=1,MarginV=42'[v]",
  "-map","[v]","-map","1:a:0","-c:v","libx264","-preset","veryfast",
  "-crf","20","-r",str(FPS),"-pix_fmt","yuv420p",
  "-c:a","aac","-b:a","192k","-movflags","+faststart","-t",str(total),trailer])

# Separate REAL recorded video excerpt. Video elementary stream is copied with
# exact native timestamps: no artificial interpolation or inserted still images.
# Original audio is discarded to avoid reusing possibly macOS 'say' licensed VO.
gameplay=OUT/"UNFIRE_GAMEPLAY_REAL_REVISION_ES.mp4"
run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",SRC,"-i",MUSIC,
  "-filter_complex",f"[1:a]atrim=duration={src_len:.3f},"
  "asetpts=PTS-STARTPTS,volume=0.14[a]",
  "-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-b:a","160k",
  "-t",str(src_len),"-movflags","+faststart",gameplay])

manifest={
 "type":"PREVIEW ONLY: not released",
 "trailer":trailer.name,
 "trailer_duration_seconds":total,
 "trailer_content":"Montage of genuine original in-game photographs plus real recorded Unfire game video. Still-picture camera moves are editing, NOT new filmed gameplay.",
 "gameplay":gameplay.name,
 "gameplay_content":"Genuine source gameplay episode excerpt; not an uninterrupted new full-map playthrough. Native video frames and timestamps retained.",
 "music":"DRAGONS — UK Bass Waves, website catalog s07.mp3. Release licensing/third-party samples must be verified separately.",
 "voice":"Robot dialog synthesized with espeak-ng, not macOS say. Spanish preview only.",
 "footage":"audio/media/UNFIRE_MUTANTS_EP01_SHORT_ES.mp4",
 "images":[s[2] for s in scenes if s[0]!="movie"],
 "limitations":[
 "Does not claim all main islands are visible together; new true overview capture needs authorized game runtime.",
 "No new raw playable movement captured. Replace montage/excerpt with recorded continuous multi-location gameplay before final release.",
 "Do not publish to YouTube, Games page or social until user reviews/approves and technical/legal QA."
 ]
}
(OUT/"REVIEW_NOT_RELEASE.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
# Verification no duplicated filenames, duration and playable A/V streams.
for name in (trailer,gameplay):
    p=probe(name);assert float(p["format"]["duration"])>10,name
    kinds={s["codec_type"] for s in p["streams"]}
    assert "video" in kinds and "audio" in kinds,name
    assert name.stat().st_size>100000,name
print(json.dumps({"trailer_seconds":video_length(trailer),
 "gameplay_seconds":video_length(gameplay),
 "trailer_bytes":trailer.stat().st_size,
 "gameplay_bytes":gameplay.stat().st_size},indent=2))
