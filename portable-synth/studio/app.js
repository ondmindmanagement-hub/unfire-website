/* Unfire Portable Synth Sequencer Lab — editable UI and bounded local transport.
 * Never changes the independent /portable-synth/play/ prototype.
 */
(() => {
  "use strict";
  const E=window.UnfireSequencerEngine,A=window.UnfireSequencerAudio;
  const $=id=>document.getElementById(id);
  let pattern=E.initialPattern();
  let context=null,graph=null,interval=null,running=false,starting=false,startEpoch=0,importEpoch=0,startAt=0,stepNumber=0,nextTime=0,visualStep=-1,rendering=false;
  const barNames=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const tones={kick:"K",snare:"S",hat:"H",bass:""};
  const N=midi=>barNames[midi%12]+(Math.floor(midi/12)-1);
  const format=n=>new Intl.NumberFormat("en-US").format(n);
  function status(message,kind="info"){$("status").textContent=message;$("status").dataset.kind=kind;}
  function redraw(track,index){
    const button=document.querySelector('.step[data-track="'+track+'"][data-step="'+index+'"]');
    if(!button)return;
    const value=pattern.tracks[track][index],active=value!==false&&value!==null;
    const name=E.TRACKS.find(t=>t.id===track).name;
    button.setAttribute("aria-pressed",String(active));
    button.setAttribute("aria-label",name+", step "+(index+1)+", "+(active?(track==="bass"?N(value):"on"):"off"));
    button.textContent=track==="bass"&&active?N(value):active?tones[track]:"";
  }
  function buildGrid(){
    const grid=$("step-grid");
    grid.replaceChildren();
    const head=document.createElement("div");head.className="grid-row header";
    const empty=document.createElement("span");head.appendChild(empty);
    for(let i=0;i<E.STEP_COUNT;i++){
      const cell=document.createElement("span");cell.className="step-number"+(i%4===0?" bar-start":"");cell.textContent=String(i+1).padStart(2,"0");head.appendChild(cell);
    }
    grid.appendChild(head);
    for(const tr of E.TRACKS){
      const row=document.createElement("div");row.className="grid-row";row.dataset.track=tr.id;
      const label=document.createElement("div");label.className="track-name";
      const dot=document.createElement("span");dot.className="track-icon";dot.setAttribute("aria-hidden","true");
      const title=document.createElement("span");title.className="track-label";title.textContent=tr.name;
      label.append(dot,title);
      if(tr.id==="bass"){const hint=document.createElement("span");hint.className="track-hint";hint.textContent="PITCH";label.appendChild(hint);}
      row.appendChild(label);
      for(let index=0;index<E.STEP_COUNT;index++){
        const button=document.createElement("button");button.type="button";button.className="step";button.dataset.step=String(index);button.dataset.track=tr.id;
        button.addEventListener("click",()=>{
          const midi=Number($("bass-note").value);
          try{pattern=E.changeStep(pattern,tr.id,index,midi);redraw(tr.id,index);}
          catch(err){status(err.message,"error");}
        });
        row.appendChild(button);
      }
      grid.appendChild(row);
      for(let index=0;index<E.STEP_COUNT;index++)redraw(tr.id,index);
    }
  }
  function synchronize(){
    $("tempo").value=String(pattern.bpm);
    $("swing").value=String(Math.round(pattern.swing*100));
    $("swing-label").textContent=Math.round(pattern.swing*100)+"%";
    $("volume").value=String(Math.round(pattern.volume*100));
    $("volume-label").textContent=Math.round(pattern.volume*100)+"%";
    $("wave").value=pattern.wave;
    if(!running)$("transport-label").textContent="READY / "+pattern.bpm+" BPM";
  }
  function clearHighlights(){
    if(visualStep<0)return;
    for(const b of document.querySelectorAll('.step.playing'))b.classList.remove("playing");
    visualStep=-1;
  }
  function highlight(index){
    if(visualStep===index)return;
    clearHighlights();
    visualStep=index;
    if(index<0)return;
    for(const b of document.querySelectorAll('.step[data-step="'+index+'"]'))b.classList.add("playing");
  }
  function disposeAudio(){
    if(interval!==null){clearInterval(interval);interval=null;}
    A.silence(graph);graph=null;
    if(context){
      const old=context;context=null;
      try{if(typeof old.close==="function")void old.close().catch(()=>{});}catch(_){}
    }
  }
  function stop(showStatus=true){
    startEpoch++;
    importEpoch++;
    starting=false;
    running=false;
    disposeAudio();clearHighlights();
    $("play").disabled=false;$("stop").disabled=true;
    $("led").classList.remove("on");
    $("transport-label").textContent="READY / "+pattern.bpm+" BPM";
    if(showStatus)status("Playback stopped. Your pattern is unchanged.");
  }
  function scheduleStep(){
    if(!graph)return;
    const pos=stepNumber%E.STEP_COUNT,bar=Math.floor(stepNumber/E.STEP_COUNT);
    const time=startAt+bar*E.barDuration(pattern.bpm)+E.stepTime(pos,pattern.bpm,pattern.swing);
    for(const track of E.TRACKS){
      const note=pattern.tracks[track.id][pos];
      if(note===null||note===false)continue;
      A.note(graph,track.id,time,track.kind==="melodic"?note:null,pattern);
    }
    stepNumber++;
    nextTime=startAt+Math.floor(stepNumber/E.STEP_COUNT)*E.barDuration(pattern.bpm)+
      E.stepTime(stepNumber%E.STEP_COUNT,pattern.bpm,pattern.swing);
  }
  function pump(){
    if(!running||!context)return;
    let guard=0;
    while(nextTime<context.currentTime+.14 && guard<20){scheduleStep();guard++;}
    const elapsed=context.currentTime-startAt;
    if(elapsed<0){highlight(-1);return;}
    const barTime=E.barDuration(pattern.bpm);
    const phase=((elapsed%barTime)+barTime)%barTime;
    let step=0;
    for(let i=1;i<E.STEP_COUNT;i++){
      if(E.stepTime(i,pattern.bpm,pattern.swing)<=phase)step=i;
      else break;
    }
    highlight(step);
  }
  async function play(){
    if(running||starting)return;
    const AudioFactory=window.AudioContext||window.webkitAudioContext;
    if(!AudioFactory){status("Web Audio is unavailable in this browser.","error");return;}
    const epoch=++startEpoch;
    starting=true;
    $("play").disabled=true;
    try{
      const p=E.valid(pattern);
      const next=new AudioFactory();
      context=next;
      if(next.state==="suspended")await next.resume();
      if(epoch!==startEpoch)return;
      if(document.hidden){stop(false);status("Playback cancelled while tab was hidden.");return;}
      if(next.state!=="running")throw new Error("Browser audio did not start");
      graph=A.setup(context,p);
      startAt=context.currentTime+.07;stepNumber=0;nextTime=startAt;
      running=true;
      $("play").disabled=true;$("stop").disabled=false;
      $("led").classList.add("on");
      $("transport-label").textContent="PLAYING / "+p.bpm+" BPM";
      pump();
      interval=setInterval(pump,35);
      status("Live loop playing. Edits take effect on upcoming steps.","success");
    }catch(err){
      if(epoch===startEpoch){stop(false);status("Could not start audio: "+err.message,"error");}
    }finally{
      if(epoch===startEpoch){starting=false;if(!running)$("play").disabled=false;}
    }
  }
  function getTempo(){
    const str=$("tempo").value;
    if(!/^\d+$/.test(str))throw new RangeError("Tempo must be a whole number from 50 to 200.");
    const n=Number(str);
    if(n<50||n>200)throw new RangeError("Tempo must be between 50 and 200 BPM.");
    return n;
  }
  $("tempo").addEventListener("change",()=>{
    try{
      const next={...pattern,bpm:getTempo()};
      pattern=E.valid(next);
      if(running)stop(false);
      synchronize();
      status("Tempo updated. Press Play to restart with the new timing.");
    }catch(err){$("tempo").value=String(pattern.bpm);status(err.message,"error");}
  });
  $("swing").addEventListener("input",()=>{
    try{
      pattern=E.valid({...pattern,swing:Number($("swing").value)/100});
      if(running)stop(false);
      synchronize();
    }catch(err){status(err.message,"error");}
  });
  $("wave").addEventListener("change",()=>{
    try{pattern=E.valid({...pattern,wave:$("wave").value});status("Synth waveform updated.");}
    catch(err){status(err.message,"error");}
  });
  $("volume").addEventListener("input",()=>{
    try{
      pattern=E.valid({...pattern,volume:Number($("volume").value)/100});
      if(graph && context)graph.master.gain.setTargetAtTime(pattern.volume*.68,context.currentTime,.015);
      synchronize();
    }catch(err){status(err.message,"error");}
  });
  $("play").addEventListener("click",()=>{void play();});
  $("stop").addEventListener("click",()=>stop());
  $("demo").addEventListener("click",()=>{
    stop(false);pattern=E.initialPattern();buildGrid();synchronize();status("Example groove restored.","success");
  });
  $("clear").addEventListener("click",()=>{
    stop(false);
    const tracks=Object.fromEntries(E.TRACKS.map(t=>[t.id,Array(E.STEP_COUNT).fill(t.kind==="melodic"?null:false)]));
    pattern=E.valid({...pattern,tracks});
    buildGrid();status("Pattern cleared. Make a new rhythm.","success");
  });
  $("random").addEventListener("click",()=>{
    stop(false);
    const odds={kick:.30,snare:.18,hat:.48,bass:.22};
    const midi=Number($("bass-note").value);
    const tracks=Object.fromEntries(E.TRACKS.map(t=>[
      t.id,Array.from({length:E.STEP_COUNT},()=>Math.random()<odds[t.id]?(t.kind==="melodic"?midi:true):(t.kind==="melodic"?null:false))
    ]));
    pattern=E.valid({...pattern,tracks});buildGrid();
    status("Randomized a new local pattern. Press Play to audition.","success");
  });
  function download(data,name,type){
    const url=URL.createObjectURL(new Blob([data],{type}));
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  $("save").addEventListener("click",()=>{
    try{download(E.serialize(pattern),"unfire-step-pattern.json","application/json");status("Pattern JSON download requested.","success");}
    catch(err){status("Could not export pattern: "+err.message,"error");}
  });
  $("import").addEventListener("change",async event=>{
    const file=event.target.files&&event.target.files[0];
    if(!file)return;
    event.target.value="";
    if(file.size>16384){status("Pattern file exceeds 16 KiB.","error");return;}
    const version=++importEpoch;
    try{
      const source=await file.text();
      if(version!==importEpoch)return;
      const imported=E.parse(source);
      stop(false);pattern=imported;buildGrid();synchronize();
      status("Pattern loaded from local JSON. No upload occurred.","success");
    }catch(err){status("Could not load pattern: "+err.message,"error");}
  });
  $("wav").addEventListener("click",async()=>{
    if(rendering)return;
    const bars=Number($("bars").value);
    if(![1,2,4].includes(bars)){status("Choose 1, 2 or 4 bars.","error");return;}
    rendering=true;$("wav").disabled=true;
    status("Rendering "+bars+" bars locally. This may take a moment.");
    try{
      const copy=E.valid(pattern);
      // Rendering starts after the event returns to keep the interface responsive.
      await new Promise(resolve=>setTimeout(resolve,15));
      const output=await A.render(copy,bars,window.OfflineAudioContext||window.webkitOfflineAudioContext);
      download(output,"unfire-step-lab-"+copy.bpm+"bpm-"+bars+"bars.wav","audio/wav");
      status("WAV download requested. Audio stayed on this device.","success");
    }catch(err){status("Audio export unavailable: "+err.message,"error");}
    finally{rendering=false;$("wav").disabled=false;}
  });
  window.addEventListener("blur",()=>{if(running||starting)stop(false);});
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&(running||starting))stop(false);});
  for(let midi=36;midi<=72;midi++){
    const option=document.createElement("option");option.value=String(midi);option.textContent=N(midi);
    if(midi===48)option.selected=true;
    $("bass-note").appendChild(option);
  }
  buildGrid();synchronize();
  status("Ready. Press Play to enable your browser audio.");
})();
