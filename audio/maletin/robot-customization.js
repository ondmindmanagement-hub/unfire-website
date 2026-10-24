/* Unfire Audio — local robot personalization. No external images, servers or telemetry. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.UnfireRobotCustom=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const COLORS=['#3d8bff','#ff2fb0','#2bd96b','#ffd21a','#ff7a1f','#9b6bff','#ffffff','#222222'];
  const CAMO=[
    ['plain','METAL'],['carbon','CARBON'],['arctic','ÁRTICO'],
    ['urban','URBANO'],['desert','DESIERTO'],['digital','DIGITAL'],['neon','NEÓN']
  ];
  const DECALS=[
    ['none','NINGUNA','—'],['star','ESTRELLA','★'],['bolt','RAYO','ϟ'],
    ['heart','CORAZÓN','♥'],['smile','SONRISA','☺'],['wave','OLA','≈']
  ];
  const palettes={
    carbon:['#243241','#43515e','#17222c'],
    arctic:['#d3eaf5','#9bb7cc','#6b859a'],
    urban:['#8f9ba9','#3f586e','#657789'],
    desert:['#d4b788','#907652','#b39a6b'],
    digital:['#5a85a4','#24475f','#829eb2'],
    neon:['#3e255c','#7840aa','#147caa']
  };
  const has=(arr,key)=>arr.some(x=>x[0]===key);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validImage=v=>typeof v==='string'&&v.length<65000&&/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(v);
  function normalize(c){
    const x=c&&typeof c==='object'?c:{};
    return {
      col:COLORS.includes(x.col)?x.col:COLORS[0],
      camo:has(CAMO,x.camo)?x.camo:'plain',
      decal:has(DECALS,x.decal)?x.decal:'none',
      image:validImage(x.image)?x.image:''
    };
  }
  const css=`
    #onl.on .b{box-sizing:border-box;width:min(442px,calc(100vw - 20px));max-height:calc(100dvh - 20px);overscroll-behavior:contain;overflow-y:auto;scrollbar-width:thin}
    #onl.on #onT{display:block!important;overflow:visible!important;max-height:none!important;min-height:0!important;touch-action:manipulation;padding:2px!important}
    #onl.on .unfireRobotSelector{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;gap:8px;align-items:center;margin:6px 0 10px}
    #onl.on .unfireRobotSelector .robotCard{width:100%;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:162px;padding:12px 8px;border:1px solid #8daee1;border-radius:17px;background:linear-gradient(165deg,#182c53,#07152e);color:#f7fbff;box-shadow:inset 0 1px 0 #ffffff35;cursor:default}
    #onl.on .unfireRobotSelector .robotCard.on{outline:2px solid #579cff;border-color:#b5dcff}
    #onl.on .unfireRobotSelector .robotPortrait{display:grid;place-items:center;width:min(126px,35vw);height:min(126px,35vw);overflow:hidden;flex:none;background:radial-gradient(ellipse at 45% 33%,#315e97,#0b1631 78%);border-radius:13px}
    #onl.on .unfireRobotSelector .robotPortrait img{width:100%;height:100%;object-fit:contain}
    #onl.on .unfireRobotSelector .robotUnknown{font:900 52px Arial;color:#9fd9ff}
    #onl.on .unfireRobotSelector .robotName{font:900 13px Arial;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    #onl.on .unfireRobotSelector .robotPerk{font:600 11px Arial;color:#b3dafa}
    #onl.on .unfireRobotSelector .robotArrow{border:1px solid #a5c7f6;border-radius:13px;height:56px;width:44px;background:#184077;color:#fff;font:800 23px Arial;cursor:pointer;touch-action:manipulation}
    #onl.on .unfireRobotSelector .robotArrow:focus-visible,#onl.on .unfireStyleButton:focus-visible,#onl.on .unfireRobotSelector .robotCard:focus-visible{outline:3px solid #45ccff;outline-offset:2px}
    #onl.on .robotCount{text-align:center;font:700 11px Arial;opacity:.72;margin-bottom:6px;letter-spacing:.06em}
    #onl.on .unfireAppearance{display:grid;gap:8px}
    #onl.on .unfireAppearance fieldset{min-width:0;margin:0;padding:8px;border:1px solid #8daee188;border-radius:12px}
    #onl.on .unfireAppearance legend{font:800 10px Arial;letter-spacing:.08em;padding:0 5px}
    #onl.on .unfireStyleRow{display:flex;flex-wrap:wrap;gap:6px}
    #onl.on .unfireStyleButton{width:auto;height:auto;min-height:32px;padding:5px 9px;border-radius:10px;border:1px solid #90add2;background:#edf5ff;color:#173a68;font:700 10px Arial;cursor:pointer;touch-action:manipulation}
    #onl.on .unfireStyleButton[aria-pressed="true"]{background:#1b56ba;color:white;border-color:#bfe9ff;box-shadow:0 0 0 1px #77b7ff}
    #onl.on .unfireImageLabel{display:inline-flex;align-items:center;justify-content:center;padding:5px 9px;border:1px solid #8ba9d3;border-radius:10px;background:#ebf5ff;color:#173a68;font:700 10px Arial;cursor:pointer;min-height:32px;box-sizing:border-box}
    #onl.on .unfireImageLabel input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
    #onl.on .unfireImageHint{font:500 10px Arial;opacity:.72;margin-top:5px}
    #onl.on.workshop .unfireAppearance{color:#edf5ff}
    #onl.on.workshop .b{overflow-y:auto!important}
    #onl.on.workshop .unfireRobotSelector .robotCard{min-height:130px}
    #onl.on.workshop .unfireStyleButton{background:#19355a;color:#edf6ff;border-color:#477db8}
    #onl.on.workshop .unfireStyleButton[aria-pressed="true"]{background:#245fc6}
    @media(max-width:800px) and (orientation:portrait){
      #onl.on.workshop .b{height:min(56dvh,470px)!important;max-height:56dvh!important}
      #onl.on.workshop .unfireRobotSelector .robotPortrait{width:86px;height:86px}
      #onl.on.workshop .unfireRobotSelector .robotCard{min-height:126px}
    }
    @media(max-height:550px){
      #onl.on .b{max-height:calc(100dvh - 12px)}
      #onl.on .unfireRobotSelector .robotCard{min-height:102px;padding:4px}
      #onl.on .unfireRobotSelector .robotPortrait{width:62px;height:62px}
      #onl.on .unfireRobotSelector .robotArrow{height:46px}
    }
    @media(prefers-reduced-motion:reduce){#onl.on .unfireRobotSelector *,#onl.on .unfireStyleButton{transition:none!important}}
  `;
  function inject(doc){
    if(!doc||doc.getElementById('unfireRobotCustomizerStyle'))return;
    const el=doc.createElement('style');el.id='unfireRobotCustomizerStyle';el.textContent=css;doc.head.appendChild(el);
  }
  function buttons(kind,options,selected){
    return options.map(([id,name,symbol])=>'<button type="button" class="unfireStyleButton" data-'+kind+'="'+id+'" aria-pressed="'+(id===selected)+'" title="'+escape(name)+'">'+(symbol?escape(symbol)+' ':'')+escape(name)+'</button>').join('');
  }
  function panel(cfg){
    const a=normalize(cfg);
    return '<section class="unfireAppearance" aria-label="Personalización del robot">'+
      '<fieldset><legend>CAMUFLAJE · METALIZADO</legend><div class="unfireStyleRow">'+buttons('camo',CAMO,a.camo)+'</div></fieldset>'+
      '<fieldset><legend>PEGATINA</legend><div class="unfireStyleRow">'+buttons('decal',DECALS,a.decal)+
      '<label class="unfireImageLabel">＋ MI IMAGEN<input id="onStickerFile" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Añadir imagen personal, solo local"></label>'+
      (a.image?'<button type="button" class="unfireStyleButton" data-image-clear="1">QUITAR IMAGEN</button>':'')+
      '</div><div class="unfireImageHint">La imagen se guarda solo en este dispositivo. No se envía al modo online.</div></fieldset></section>';
  }
  function materialPattern(name,THREE){
    if(name==='plain'||!palettes[name]||!THREE)return null;
    const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
    if(!g)return null;
    const cols=palettes[name];g.fillStyle=cols[0];g.fillRect(0,0,128,128);
    for(let i=0;i<44;i++){
      const x=(i*37)%132-8,y=(i*57)%134-8;
      g.fillStyle=cols[(i%2)+1];
      g.fillRect(x,y,name==='digital'?13:22,name==='digital'?10:9);
      if(name!=='digital'){g.fillRect(x+5,y-5,13,6);}
    }
    if(name==='carbon'){
      g.strokeStyle='#7d97ad';g.globalAlpha=.28;
      for(let i=-128;i<256;i+=12){g.beginPath();g.moveTo(i,0);g.lineTo(i+128,128);g.stroke();}
    }
    const texture=new THREE.CanvasTexture(c);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(2,2);
    return texture;
  }
  function stickerCanvas(a){
    const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
    g.clearRect(0,0,128,128);
    if(a.image){const im=new Image();im.onload=()=>{g.clearRect(0,0,128,128);g.drawImage(im,0,0,128,128);if(c._texture)c._texture.needsUpdate=true;};im.src=a.image;}
    else {
      const icon=DECALS.find(x=>x[0]===a.decal);
      g.textAlign='center';g.textBaseline='middle';g.font='900 94px Arial';
      g.lineWidth=8;g.strokeStyle='#071d38';g.strokeText(icon?icon[2]:'★',64,67);
      g.fillStyle='#fff9bf';g.fillText(icon?icon[2]:'★',64,67);
    }
    return c;
  }
  // Mesh-local metallic tint and lightweight camouflage: retains the original
  // geometry, normals, lighting and any authored diffuse maps/face details.
  function apply(root,cfg,THREE){
    if(!root||!THREE)return;
    const a=normalize(cfg),texture=materialPattern(a.camo,THREE);
    let index=0,usesPattern=false;
    root.traverse(o=>{
      if(!o.isMesh||!o.material)return;
      const source=Array.isArray(o.material)?o.material:[o.material];
      const next=source.map(mat=>{
        if(!mat||!mat.color||typeof mat.clone!=='function')return mat;
        const m=mat.clone();
        m.userData=Object.assign({},m.userData,{unfireCustomMaterial:true});
        if(typeof m.metalness==='number')m.metalness=Math.max(.72,m.metalness);
        if(typeof m.roughness==='number')m.roughness=Math.min(.37,m.roughness);
        if(texture&&!m.map&&!m.transparent&&!m.emissiveMap&&typeof m.metalness==='number'){
          m.map=texture;m.userData.unfirePatternTexture=true;usesPattern=true;m.color.lerp(new THREE.Color(a.col),.2);
        }else if(typeof m.metalness==='number'){
          m.color.lerp(new THREE.Color(a.col),a.camo==='plain'?.38:.18);
        }
        index++;
        return m;
      });
      o.material=Array.isArray(o.material)?next:next[0];
    });
    if(texture&&!usesPattern&&texture.dispose)texture.dispose();
    if(a.decal==='none'&&!a.image)return;
    const box=new THREE.Box3().setFromObject(root);
    const dims=box.getSize(new THREE.Vector3()),mid=box.getCenter(new THREE.Vector3());
    if(!Number.isFinite(dims.y)||dims.y<=0)return;
    const canvas=stickerCanvas(a),tex=new THREE.CanvasTexture(canvas);canvas._texture=tex;tex.colorSpace=THREE.SRGBColorSpace;
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.1,dims.x*.34),Math.max(.1,dims.y*.20)),mat);
    plane.name='unfire-personalized-sticker';plane.position.set(mid.x,box.min.y+dims.y*.57,box.max.z+.035);
    root.add(plane);
  }
  // Release only resources introduced by personalization, never shared robot assets.
  function release(root) {
    if(!root||typeof root.traverse!=='function')return;
    const textures=new Set(),materials=new Set(),stickers=[];
    root.traverse(o=>{
      if(!o.isMesh)return;
      if(o.name==='unfire-personalized-sticker'){
        stickers.push(o);
        if(o.material){if(o.material.map)textures.add(o.material.map);materials.add(o.material);}
      }else{
        const arr=Array.isArray(o.material)?o.material:[o.material];
        for(const mat of arr){
          if(!mat||!mat.userData||!mat.userData.unfireCustomMaterial)continue;
          if(mat.userData.unfirePatternTexture&&mat.map)textures.add(mat.map);
          materials.add(mat);
        }
      }
    });
    for(const o of stickers){
      if(o.parent)o.parent.remove(o);
      if(o.geometry&&o.geometry.dispose)o.geometry.dispose();
    }
    for(const material of materials)if(material.dispose)material.dispose();
    for(const texture of textures)if(texture.dispose)texture.dispose();
  }
  function upload(file){
    return new Promise((resolve,reject)=>{
      if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>700000)
        return reject(Error('Usa PNG, JPG o WebP de menos de 700 KB.'));
      const url=URL.createObjectURL(file),im=new Image();
      const finish=()=>URL.revokeObjectURL(url);
      im.onerror=()=>{finish();reject(Error('No se pudo leer la imagen.'));};
      im.onload=()=>{
        try{
          if(im.width>4096||im.height>4096||!im.width||!im.height)throw Error('Imagen demasiado grande.');
          const c=document.createElement('canvas');c.width=c.height=96;
          const g=c.getContext('2d');g.clearRect(0,0,96,96);
          const scale=Math.min(96/im.width,96/im.height),w=im.width*scale,h=im.height*scale;
          g.drawImage(im,(96-w)/2,(96-h)/2,w,h);
          const data=c.toDataURL('image/webp',.66);
          if(!validImage(data))throw Error('Imagen comprimida demasiado grande.');
          finish();resolve(data);
        }catch(e){finish();reject(e);}
      };
      im.src=url;
    });
  }
  return {COLORS,CAMO,DECALS,normalize,panel,inject,apply,release,upload,css};
});
