/* Unfire Power Web: user-supplied data, no network calls, no storage. */
(()=>{
  "use strict";
  const E=window.UnfirePowerEngine;
  const $=id=>document.getElementById(id);
  const money=new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",minimumFractionDigits:3,maximumFractionDigits:4});
  const priceFormat=new Intl.NumberFormat("en-IE",{minimumFractionDigits:4,maximumFractionDigits:4});
  let data=null,loadId=0,renderSeq=0;
  function madridToday(){
    const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
    return p.year+"-"+p.month+"-"+p.day;
  }
  function status(msg,kind="neutral"){
    $("state").textContent=msg;
    $("state").dataset.kind=kind;
  }
  function displayDate(date){
    if(!date)return "—";
    const [y,m,d]=date.split("-");
    return d+"/"+m+"/"+y;
  }
  function clearMetrics(){
    for(const id of ["best-price","worst-price","savings-price","fixed-cost"])$(id).textContent="—";
    $("best-window").textContent="Awaiting valid data";
    $("worst-window").textContent="Awaiting valid data";
    $("export").disabled=true;
  }
  function meta(){
    $("source-label").textContent=data?data.source:"No hourly series";
    $("data-date").textContent=data?displayDate(data.day):"—";
    let stamp="Not supplied";
    if(data?.updated){
      try{
        stamp=new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Madrid"}).format(new Date(data.updated))+" Europe/Madrid";
      }catch{stamp="Invalid timestamp";}
    }else if(data?.source.includes("SYNTHETIC"))stamp="Fictional example";
    $("updated").textContent=data?stamp:"Not verified";
  }
  function chart(result){
    const wrap=$("hour-list");
    wrap.replaceChildren();
    if(!data){
      const p=document.createElement("p");p.className="empty";p.textContent="Hourly chart will appear here after you load prices.";wrap.appendChild(p);return;
    }
    const vals=data.rows.map(x=>x.price),min=Math.min(...vals),max=Math.max(...vals);
    const length=Math.max(1e-6,max-min);
    data.rows.forEach((row,i)=>{
      const chosen=result&&i>=result.best.start&&i<result.best.start+result.hours;
      const item=document.createElement("div");item.className="hour"+(chosen?" best":"");item.setAttribute("role","listitem");
      const time=document.createElement("span");time.className="hour-date";time.textContent=row.label+(row.offset?" "+row.offset:"");
      const barTrack=document.createElement("span");barTrack.className="bar-track";barTrack.setAttribute("aria-hidden","true");
      const bar=document.createElement("span");bar.className="bar";
      bar.style.width=(max===min?65:Math.max(3,Math.round(100*(row.price-min)/length)))+"%";
      barTrack.appendChild(bar);
      const amount=document.createElement("span");amount.className="hour-price";amount.textContent=priceFormat.format(row.price);
      item.setAttribute("aria-label",time.textContent+": "+priceFormat.format(row.price)+" euro per kilowatt-hour"+(chosen?", selected low-cost window":""));
      item.append(time,barTrack,amount);wrap.appendChild(item);
    });
  }
  function render(){
    const seq=++renderSeq;
    clearMetrics();meta();
    if(!data){chart(null);return;}
    let result;
    try{result=E.calculate(data,$("power").value,$("duration").value,$("fixed").value);}
    catch(err){chart(null);status(err.message,"error");return;}
    if(seq!==renderSeq)return;
    $("best-price").textContent=money.format(result.best.price);
    $("worst-price").textContent=money.format(result.worst.price);
    $("savings-price").textContent=money.format(result.savings);
    $("fixed-cost").textContent=result.fixedCost===null?"Not set":money.format(result.fixedCost);
    function label(win){
      const row=data.rows[win.start];
      return "Starts "+row.label+(row.offset?" "+row.offset:"")+" · "+result.hours+" h · "+priceFormat.format(result.kwh)+" kWh";
    }
    $("best-window").textContent=label(result.best);
    $("worst-window").textContent=label(result.worst);
    $("export").disabled=false;
    chart(result);
  }
  function setData(next,kind){
    data=next;
    render();
    status(kind==="example"?"SYNTHETIC EXAMPLE ONLY. These prices are invented for practice — not today's energy prices.":kind==="official"?"Official PVPC indicator 1001 loaded from your local JSON file. Source date and update shown below.":"User-entered hourly prices loaded. No external verification or upload performed.","success");
  }
  function resetDay(){
    ++loadId;
    data=null;
    render();
    status("Date changed. Load a matching "+E.daySlots($("day").value).length+"-hour price series for this day.");
    $("official-api").href=E.officialURL($("day").value);
  }
  $("day").value=madridToday();
  $("official-api").href=E.officialURL($("day").value);
  $("day").addEventListener("change",()=>{
    try{resetDay();}catch(err){data=null;render();status(err.message,"error");}
  });
  $("sample").addEventListener("click",()=>{
    ++loadId;
    try{setData(E.example($("day").value),"example");}
    catch(err){data=null;render();status(err.message,"error");}
  });
  $("load-manual").addEventListener("click",()=>{
    ++loadId;
    try{setData(E.manual($("manual").value,$("day").value),"manual");}
    catch(err){data=null;render();status(err.message,"error");}
  });
  $("import-json").addEventListener("change",async()=>{
    const file=$("import-json").files?.[0];
    if(!file)return;
    const ticket=++loadId,day=$("day").value;
    $("import-json").value="";
    data=null;render();
    if(file.size>256*1024){status("The REData JSON file is larger than 256 KiB.","error");return;}
    if(file.size===0){status("The selected file is empty.","error");return;}
    try{
      const raw=await file.text();
      if(ticket!==loadId||day!==$("day").value)return;
      const next=E.official(JSON.parse(raw),day);
      if(ticket!==loadId)return;
      setData(next,"official");
    }catch(err){
      if(ticket===loadId){data=null;render();status("Could not import PVPC: "+err.message,"error");}
    }
  });
  for(const id of ["power","duration","fixed"]){
    $(id).addEventListener("change",()=>{
      if(data){render();if($("export").disabled)return;status("Estimate recalculated using the current appliance settings.","success");}
    });
    $(id).addEventListener("input",()=>{
      if(data){render();if($("export").disabled)return;status("Estimate recalculated using the current appliance settings.","success");}
    });
  }
  $("export").addEventListener("click",()=>{
    if(!data)return;
    const text=E.csv(data),url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="unfire-power-web-"+data.day+".csv";
    document.body.appendChild(a);a.click();a.remove();
    // Browser controls whether a download completes; no success claim is made.
    setTimeout(()=>URL.revokeObjectURL(url),1200);
    status("CSV download requested. The imported hourly data stayed on this device.","success");
  });
  render();
})();