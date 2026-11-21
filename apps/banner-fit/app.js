(function () {
  'use strict';
  var E=window.BannerFitEngine, el=function(id){return document.getElementById(id);};
  var ui={file:el('file'),drop:el('dropzone'),preset:el('preset'),custom:el('custom-fields'),
    width:el('width'),height:el('height'),cover:el('cover'),contain:el('contain'),
    fx:el('focus-x'),fy:el('focus-y'),fxOut:el('focus-x-value'),fyOut:el('focus-y-value'),
    background:el('background'),format:el('format'),canvas:el('canvas'),
    dimensions:el('dimension-label'),download:el('download'),meta:el('file-meta'),status:el('status')};
  var source=null,name='artwork',mode='cover',generation=0,frame=0,exporting=false;
  E.presets.forEach(function(p){
    var o=document.createElement('option');o.value=p.id;
    o.textContent=p.label+' · '+p.width+' × '+p.height;ui.preset.appendChild(o);
  });
  function status(text,error){ui.status.textContent=text;ui.status.style.color=error?'#ffb4b5':'';}
  function size(){
    var p=E.presets.find(function(x){return x.id===ui.preset.value;})||E.presets[0];
    return E.validateDimensions(p.id==='custom'?Number(ui.width.value):p.width,p.id==='custom'?Number(ui.height.value):p.height);
  }
  function render(){
    frame=0;
    try{
      var d=size();ui.dimensions.textContent=d.width+' × '+d.height+' px';
      ui.canvas.width=d.width;ui.canvas.height=d.height;
      var ctx=ui.canvas.getContext('2d',{alpha:false});
      if(!ctx)throw new Error('Canvas is not supported here.');
      ctx.fillStyle=ui.background.value;ctx.fillRect(0,0,d.width,d.height);
      if(source){
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
        var p=E.computePlacement(source.naturalWidth,source.naturalHeight,d.width,d.height,mode,+ui.fx.value,+ui.fy.value);
        ctx.drawImage(source,p.x,p.y,p.width,p.height);
        status('Ready to export · local processing only.');
      }else{
        ctx.strokeStyle='#476785';ctx.lineWidth=Math.max(2,d.width/600);
        ctx.strokeRect(d.width*.13,d.height*.15,d.width*.74,d.height*.7);
        ctx.fillStyle='#a4b9d6';ctx.font='600 '+Math.max(20,d.width/34)+'px sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('YOUR CANVAS',d.width/2,d.height/2);
      }
      ui.download.disabled=!source||exporting;
    }catch(e){ui.download.disabled=true;ui.dimensions.textContent='Invalid dimensions';status(e.message||'Render failed.',true);}
  }
  function redraw(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}
  function fit(which){
    mode=which;ui.cover.classList.toggle('active',which==='cover');ui.contain.classList.toggle('active',which==='contain');
    ui.cover.setAttribute('aria-pressed',String(which==='cover'));
    ui.contain.setAttribute('aria-pressed',String(which==='contain'));redraw();
  }
  function load(file){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){status('Choose PNG, JPEG or WebP; previous image unchanged.',true);return;}
    if(!Number.isFinite(file.size)||file.size>20*1024*1024){status('Image exceeds 20 MB; previous image unchanged.',true);return;}
    var own=++generation,img=new Image(),reader=new FileReader();
    status('Opening image on this device…');
    img.onload=function(){
      if(own!==generation)return;
      if(img.naturalWidth*img.naturalHeight>24000000){status('Image exceeds 24 million source pixels.',true);return;}
      source=img;name=file.name||'artwork';
      ui.meta.textContent=name+' · '+img.naturalWidth+' × '+img.naturalHeight;redraw();
    };
    img.onerror=function(){if(own===generation)status('Cannot read this image. Try PNG or JPEG.',true);};
    reader.onload=function(){if(own===generation && typeof reader.result==='string')img.src=reader.result;};
    reader.onerror=function(){if(own===generation)status('Could not read the selected image.',true);};
    reader.readAsDataURL(file);
  }
  ui.file.addEventListener('change',function(){load(ui.file.files[0]);});
  ['dragenter','dragover'].forEach(function(type){ui.drop.addEventListener(type,function(e){e.preventDefault();ui.drop.classList.add('dragging');});});
  ['dragleave','drop'].forEach(function(type){ui.drop.addEventListener(type,function(e){e.preventDefault();ui.drop.classList.remove('dragging');});});
  ui.drop.addEventListener('drop',function(e){load(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]);});
  ui.preset.addEventListener('change',function(){ui.custom.hidden=ui.preset.value!=='custom';redraw();});
  [ui.width,ui.height,ui.fx,ui.fy,ui.background].forEach(function(x){x.addEventListener('input',function(){
    ui.fxOut.textContent=ui.fx.value+'%';ui.fyOut.textContent=ui.fy.value+'%';redraw();
  });});
  ui.cover.addEventListener('click',function(){fit('cover');});
  ui.contain.addEventListener('click',function(){fit('contain');});
  ui.download.addEventListener('click',function(){
    if(!source||exporting)return;
    try{
      var d=size();exporting=true;ui.download.disabled=true;
      if(frame)cancelAnimationFrame(frame);render();
      var jpeg=ui.format.value==='jpg';
      ui.canvas.toBlob(function(blob){
        exporting=false;
        if(!blob){status('Export failed in this browser; try PNG.',true);ui.download.disabled=false;return;}
        var url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=E.exportName(name,d.width,d.height,jpeg?'jpg':'png');
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(url);},15000);
        status('Export ready · no upload performed.');ui.download.disabled=false;
      },jpeg?'image/jpeg':'image/png',jpeg?.9:undefined);
    }catch(e){exporting=false;status(e.message||'Export failed.',true);redraw();}
  });
  ui.preset.value='youtube-banner';ui.custom.hidden=true;redraw();
})();