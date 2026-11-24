#!/usr/bin/env python3
"""Original Unfire web identity artwork. No external assets or typefaces."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/products/icons'
OUT.mkdir(parents=True,exist_ok=True)
# An original dark, precision-machined visual language; individual motifs identify each tool.
ART={
'autonomy':('#8bc7ff','<path d="M54 71h28m28 0h28M96 85v35M54 71v58m84-58v58" /><rect x="80" y="55" width="32" height="32" rx="9" fill="#253e58"/><rect x="38" y="113" width="32" height="32" rx="9"/><rect x="122" y="113" width="32" height="32" rx="9"/><path d="m88 71 6 6 11-12" stroke="#ddf3ff"/>'),
'archer-web':('#ff9e64','<path d="M40 113h23l16-49 24 66 17-36h32" stroke-width="8"/><path d="M42 55h108M42 143h108" stroke-opacity=".35"/><circle cx="144" cy="55" r="5" fill="#ff9e64" stroke="none"/>'),
'portable-synth':('#7fdbc6','<rect x="38" y="42" width="116" height="108" rx="15" fill="#182b31"/><path d="M51 70h15l8-11 12 21 11-15 12 5h32"/><rect x="51" y="94" width="90" height="43" rx="5" fill="#dce9e7" stroke="none"/><path d="M69 95v41m18-41v41m18-41v41m18-41v41" stroke="#44636a" stroke-width="3"/><path d="M69 94v19m36-19v19m18-19v19" stroke="#17282b" stroke-width="9"/>'),
'portable-synth-studio':('#83d9c8','<rect x="40" y="44" width="112" height="104" rx="14"/>'+''.join(f'<rect x="{52+23*c}" y="{60+24*r}" width="15" height="15" rx="3" fill="{("#83d9c8" if (r,c) in [(0,0),(0,2),(1,1),(2,0),(2,3)] else "#25454a")}" stroke="none"/>' for r in range(3) for c in range(4))+'<path d="M53 137h86" stroke-opacity=".5"/>'),
'sound-lab':('#83c5ff','<circle cx="96" cy="96" r="53" stroke-opacity=".34"/><path d="M37 96h16c13 0 13-32 26-32s13 64 26 64 13-32 26-32h24" stroke-width="7"/><circle cx="96" cy="96" r="3" fill="#dcefff" stroke="none"/>'),
'hyperwave-2000':('#91b9ff','<path d="M44 104q52-63 104 0l-13 32H57z" fill="#263d67"/><path d="M51 107q45-48 90 0" stroke="#e1efff"/><path d="M45 110 25 92l10-13 25 17m87 14 20-18-10-13-25 17" stroke="#e5ac72" stroke-width="7"/><path d="M65 118h62v18H65z" fill="#e7ebf2" stroke="none"/><path d="M76 118v18m11-18v18m11-18v18m11-18v18m11-18v18" stroke="#223551" stroke-width="2"/>'),
'power-web':('#f3c774','<path d="M44 132 73 106l20 12 29-53 26 7" stroke-width="7"/><path d="M45 52v88h108" stroke-opacity=".4"/><circle cx="122" cy="65" r="5" fill="#ffe4a1" stroke="none"/>'),
'ai-token-counter':('#b3a4ff','<rect x="41" y="41" width="110" height="110" rx="15"/><path d="M59 67h74M59 83h42" stroke-opacity=".45"/><path d="M61 126v-17m23 17V99m23 27v-33m23 33v-48" stroke-width="8"/>'),
'app-ready':('#a3d4ad','<rect x="55" y="38" width="82" height="116" rx="17"/><path d="m72 95 17 18 32-39" stroke-width="8"/><path d="M83 139h26" stroke-opacity=".55"/>'),
'privacy-lens':('#94c4f1','<path d="M96 39 143 57v38c0 28-18 47-47 59-29-12-47-31-47-59V57z" fill="#263e59"/><path d="M64 95q32-35 64 0-32 35-64 0z"/><circle cx="96" cy="95" r="13" fill="#94c4f1" stroke="none"/><circle cx="96" cy="95" r="5" fill="#142039" stroke="none"/>'),
'file-prep':('#b9c9f3','<path d="M57 38h51l28 29v86H57z" fill="#28354b"/><path d="M108 38v30h28M73 86h47M73 102h35M73 119h47M73 136h25"/>'),
'banner-fit':('#e4b5f2','<rect x="42" y="57" width="108" height="78" rx="10" fill="#302542"/><path d="M52 111 76 87l17 17 15-12 32 29"/><circle cx="116" cy="78" r="8"/><path d="M34 75V49h26m98 26V49h-26M34 117v26h26m98-26v26h-26" stroke-width="4"/>'),
'signals':('#92bffa','<path d="M45 123a51 51 0 0 1 102 0M61 123a35 35 0 0 1 70 0M77 123a19 19 0 0 1 38 0" stroke-width="6"/><circle cx="96" cy="126" r="8" fill="#c6e1ff" stroke="none"/><path d="M96 47v-8M46 65l-6-7m106 7 6-7" stroke-opacity=".4"/>'),
'unfire-synth':('#cbb8ff','<rect x="38" y="46" width="116" height="100" rx="15"/><path d="M50 74h12l11-14 13 28 13-20 15 6h28" stroke-width="5"/><rect x="52" y="101" width="88" height="30" rx="3" fill="#dce1f4" stroke="none"/><path d="M69 102v29m18-29v29m18-29v29m18-29v29" stroke="#333a59" stroke-width="3"/>'),
'keybridge':('#92bffa','<rect x="40" y="58" width="70" height="84" rx="13"/><rect x="119" y="38" width="34" height="79" rx="8"/><path d="M69 99h67m-11-11 11 11-11 11" stroke-width="6"/><circle cx="74" cy="99" r="13" fill="#263c56"/>'),
}
def svg(accent,art):
 return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#26344b"/><stop offset="1" stop-color="#090f1b"/></linearGradient><radialGradient id="light" cx=".3" cy=".18" r=".85"><stop stop-color="{accent}" stop-opacity=".22"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></radialGradient><linearGradient id="edge" x2=".7" y2="1"><stop stop-color="#b8c8dd" stop-opacity=".72"/><stop offset="1" stop-color="#43536c" stop-opacity=".38"/></linearGradient></defs>
<rect x="3" y="3" width="186" height="186" rx="43" fill="url(#bg)" stroke="url(#edge)" stroke-width="2"/><rect x="8" y="8" width="176" height="176" rx="38" fill="url(#light)"/><rect x="20" y="20" width="152" height="152" rx="30" fill="none" stroke="{accent}" stroke-opacity=".13"/>
<g fill="none" stroke="{accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">{art}</g>
<path d="M77 167h38" stroke="{accent}" stroke-width="2" stroke-linecap="round" opacity=".45"/></svg>'''
for name,(color,art) in ART.items():
 (OUT/(name+'.svg')).write_text(svg(color,art)+'\n')
