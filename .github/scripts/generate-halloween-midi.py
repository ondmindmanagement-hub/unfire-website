#!/usr/bin/env python3
"""Deterministic, original mini MIDI loops for a truly free Unfire Halloween gift.
No DAW/JUCE/framework dependency. The resulting ZIP contains only MIDI and a license.
"""
from pathlib import Path
import hashlib, json, struct, zipfile

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'audio/halloween'
MIDIDIR=OUT/'midi'
TPQ=480

def vlq(n):
    assert n>=0
    buf=[n & 127];n>>=7
    while n:buf.insert(0,(n&127)|128);n>>=7
    return bytes(buf)

def piece(name,bpm,notes):
    events=[]
    for tick,key,duration,velocity in notes:
        assert 0<=key<128 and 1<=velocity<=127 and 0<duration and tick>=0
        events.extend(((tick,1,bytes([0x90,key,velocity])),(tick+duration,0,bytes([0x80,key,0]))))
    events.sort(key=lambda x:(x[0],x[1],x[2]))
    title=name.encode('ascii')
    track=bytearray()
    track+=b'\x00\xff\x03'+vlq(len(title))+title
    track+=b'\x00\xff\x51\x03'+round(60000000/bpm).to_bytes(3,'big')
    track+=b'\x00\xff\x58\x04\x04\x02\x18\x08'
    cur=0
    for tick,_,m in events:
        track+=vlq(tick-cur)+m;cur=tick
    track+=vlq(max(0,TPQ*16-cur))+b'\xff\x2f\x00'
    return b'MThd'+struct.pack('>IHHH',6,0,1,TPQ)+b'MTrk'+struct.pack('>I',len(track))+track

# Original, short four-bar motifs written for this campaign; no existing melodies or samples used.
patterns={
 'midnight_signal_124bpm.mid':('Midnight Signal',124,[(b*1920+i*240, (57,60,64,67,69,67,64,60)[(i+2*b)%8],195,82+((i+b)%3)*9) for b in range(4) for i in range(8)]),
 'clockwork_crypt_120bpm.mid':('Clockwork Crypt',120,[(b*1920+i*480, (50,57,53,56)[(i+b)%4],360,94) for b in range(4) for i in range(4)]+[(b*1920+i*480+240,(62,65,68,65)[(i+b)%4],160,65) for b in range(4) for i in range(4)]),
 'lantern_glide_100bpm.mid':('Lantern Glide',100,[(b*1920+i*240,(48,55,60,63,67,63,60,55)[(i+b)%8],225,73+((i*2+b)%4)*7) for b in range(4) for i in range(8)]),
 'haunted_steps_138bpm.mid':('Haunted Steps',138,[(b*1920+i*240,(52,53,59,64,52,59,65,53)[(i+3*b)%8],170,78+((i+b)%2)*18) for b in range(4) for i in range(8)]),
}
README='''UNFIRE AUDIO — HALLOWEEN MIDI PACK 2026

Contenido: 4 secuencias MIDI originales de 4 compases. No incluyen sonido/audio ni plugins.
Todas son GRATIS, sin compra, correo, cuenta ni ruleta. Importa los archivos MIDI en un DAW compatible.

Licencia de uso: puedes modificarlas y usarlas en composiciones musicales personales y comerciales,
incluidas canciones publicadas; no tienes que atribuir Unfire. No revendas ni redistribuyas
estos archivos o el paquete sin modificaciones como producto propio.

Se entregan tal cual, sin garantía de compatibilidad con todos los DAWs.
Más información: https://unfire.technology/audio/halloween/
© 2026 Unfire Audio
'''
MIDIDIR.mkdir(parents=True,exist_ok=True)
manifest={"license":"free_original_midi_patterns","made":"2026-10-23","requires_purchase":False,"total":len(patterns),"files":{}}
for filename, (name,bpm,notes) in sorted(patterns.items()):
    data=piece(name,bpm,notes)
    (MIDIDIR/filename).write_bytes(data)
    manifest['files'][filename]={"bpm":bpm,"sha256":hashlib.sha256(data).hexdigest(),"notes":len(notes),"bars":4}
(OUT/'LEEME.txt').write_text(README,encoding='utf8')
(OUT/'midi-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
zip_path=OUT/'unfire-halloween-midi-gratis-2026.zip'
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for f in sorted([*MIDIDIR.glob('*.mid'),OUT/'LEEME.txt']):
        info=zipfile.ZipInfo(f.name,date_time=(2026,10,23,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,f.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
print('created:',zip_path,'size:',zip_path.stat().st_size,'sha256:',hashlib.sha256(zip_path.read_bytes()).hexdigest())
