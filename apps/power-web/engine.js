/* Unfire Power Web engine — local arithmetic, strict PVPC import, no networking. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.UnfirePowerEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const TZ="Europe/Madrid";
  const HOUR=3600000;
  const MAX_TEXT=16384;
  const decimal=/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
  function isoDate(day){
    if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("Use a valid YYYY-MM-DD date.");
    const ms=Date.parse(day+"T00:00:00Z");
    if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==day)throw Error("Invalid calendar date.");
    return day;
  }
  const dtf=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZoneName:"shortOffset"});
  function localParts(ms){
    const x=Object.fromEntries(dtf.formatToParts(new Date(ms)).filter(v=>v.type!=="literal").map(v=>[v.type,v.value]));
    return {day:x.year+"-"+x.month+"-"+x.day,label:x.hour+":"+x.minute,offset:x.timeZoneName||""};
  }
  function daySlots(day){
    const d=isoDate(day),mid=Date.parse(d+"T00:00:00Z"),slots=[];
    // Covers UTC±12 and all normal 23-, 24-, or 25-hour Madrid calendar days.
    for(let i=-14;i<=38;i++){
      const ms=mid+i*HOUR,p=localParts(ms);
      if(p.day===d)slots.push({utc:new Date(ms).toISOString(),label:p.label,offset:p.offset});
    }
    if(![23,24,25].includes(slots.length))throw Error("Could not resolve local calendar hours.");
    return slots;
  }
  function amount(value,min,max,label){
    const s=typeof value==="number"?String(value):String(value??"").trim().replace(",",".");
    if(!decimal.test(s))throw Error(label+" must be a number.");
    const n=Number(s);
    if(!Number.isFinite(n)||n<min||n>max)throw Error(label+" must be between "+min+" and "+max+".");
    return n;
  }
  function normalizeEntries(entries,day,source,updated){
    const slots=daySlots(day);
    if(!Array.isArray(entries)||entries.length!==slots.length)throw Error("Expected "+slots.length+" hourly prices for "+day+".");
    const map=new Map();
    for(const item of entries){
      if(!item||typeof item.utc!=="string")throw Error("Missing hour timestamp.");
      const ms=Date.parse(item.utc);
      if(!Number.isFinite(ms)||ms%HOUR!==0)throw Error("Invalid hourly timestamp.");
      const key=new Date(ms).toISOString();
      if(map.has(key))throw Error("Duplicate hourly timestamp.");
      map.set(key,amount(item.price,-2,10,"Price €/kWh"));
    }
    return {day,source,updated:updated||null,rows:slots.map(s=>{
      if(!map.has(s.utc))throw Error("Missing hour "+s.label+" ("+s.offset+").");
      return {...s,price:map.get(s.utc)};
    })};
  }
  function manual(text,day){
    const val=String(text||"");
    if(val.length>MAX_TEXT)throw Error("Input is too large.");
    const slots=daySlots(day);
    const chunks=val.split(/[\r\n;]+/).map(s=>s.trim()).filter(Boolean);
    if(chunks.length!==slots.length)throw Error("Expected "+slots.length+" prices, one per local hour.");
    return normalizeEntries(chunks.map((s,i)=>({utc:slots[i].utc,price:amount(s,-2,10,"Hour "+(i+1))})),day,"Manual hourly values",null);
  }
  function official(obj,day){
    isoDate(day);
    if(!obj||!Array.isArray(obj.included))throw Error("Not a REData response with included series.");
    const matching=obj.included.filter(x=>String(x?.id)==="1001");
    if(matching.length!==1)throw Error("Official REData PVPC indicator 1001 is missing or ambiguous.");
    const values=matching[0]?.attributes?.values;
    if(!Array.isArray(values)||values.length>25)throw Error("Unexpected PVPC series length.");
    const entries=values.map(v=>{
      if(typeof v?.value!=="number"||!Number.isFinite(v.value)||v.value< -2000||v.value>10000)throw Error("Invalid PVPC price in €/MWh.");
      if(typeof v.datetime!=="string")throw Error("PVPC timestamp missing.");
      return {utc:v.datetime,price:v.value/1000};
    });
    const stamp=obj?.data?.attributes?.["last-update"]||matching[0]?.attributes?.["last-update"]||null;
    if(stamp!==null&&(typeof stamp!=="string"||!Number.isFinite(Date.parse(stamp))))throw Error("Invalid source update timestamp.");
    return normalizeEntries(entries,day,"Red Eléctrica · REData PVPC 1001 (user-imported JSON)",stamp);
  }
  function example(day){
    const slots=daySlots(day);
    return normalizeEntries(slots.map((s,i)=>({utc:s.utc,price:Number((0.10+0.10*(Math.sin(i*0.35+1)+1)/2+0.02*(i%4===0?1:0)).toFixed(4))})),day,"SYNTHETIC DEMO — not actual electricity prices",null);
  }
  function calculate(data,power,duration,fixed){
    if(!data||!Array.isArray(data.rows)||data.rows.length<23||data.rows.length>25)throw Error("Load valid hourly prices first.");
    const kw=amount(power,0.01,100,"Appliance power (kW)");
    const hours=amount(duration,1,6,"Runtime (hours)");
    if(!Number.isInteger(hours))throw Error("Runtime must be whole hours.");
    const fixedPrice=(fixed===""||fixed===null||fixed===undefined)?null:amount(fixed,-2,10,"Fixed comparison rate");
    const costs=[];
    for(let start=0;start+hours<=data.rows.length;start++){
      const slice=data.rows.slice(start,start+hours);
      costs.push({start,price:kw*slice.reduce((sum,item)=>sum+item.price,0),label:slice[0].label+"–"+(slice.at(-1).label)+" ("+hours+" h)"});
    }
    if(!costs.length)throw Error("No valid appliance window.");
    const best=costs.reduce((a,b)=>b.price<a.price?b:a),worst=costs.reduce((a,b)=>b.price>a.price?b:a);
    return {kw,hours,kwh:kw*hours,best,worst,savings:Math.max(0,worst.price-best.price),fixedCost:fixedPrice===null?null:kw*hours*fixedPrice,mean:data.rows.reduce((sum,x)=>sum+x.price,0)/data.rows.length,windowCount:costs.length};
  }
  function csv(data){
    if(!data||!Array.isArray(data.rows))throw Error("No data to export.");
    const clean=x=>'"'+String(x??"").replace(/"/g,'""').replace(/^[=+\-@\t\r]/,"'")+'"';
    const list=[["Local date","Local hour","Offset","UTC timestamp","EUR per kWh","Source","Last source update"]];
    for(const row of data.rows)list.push([data.day,row.label,row.offset,row.utc,row.price.toFixed(6),data.source,data.updated||"not supplied"]);
    return "\uFEFF"+list.map(r=>r.map(clean).join(",")).join("\r\n")+"\r\n";
  }
  function officialURL(day){
    isoDate(day);
    const d=encodeURIComponent(day+"T00:00"),end=encodeURIComponent(day+"T23:59");
    return "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date="+d+"&end_date="+end+"&time_trunc=hour";
  }
  return {isoDate,daySlots,manual,official,example,calculate,csv,officialURL,amount};
});