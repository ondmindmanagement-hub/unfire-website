"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const E=require("./engine.js");
const date="2026-11-21";
const slots=E.daySlots(date);
const prices=Array(24).fill("0.2000");
function fixture(day=date){
  const s=E.daySlots(day);
  return {data:{attributes:{"last-update":"2026-11-21T20:20:00+01:00"}},included:[
    {id:"600",attributes:{title:"Spot",values:s.flatMap(x=>[0,1,2,3].map(i=>({datetime:x.utc,value:1})))}},
    {id:"1001",attributes:{title:"PVPC",values:s.map((x,i)=>({datetime:x.utc,value:100+i}))}}
  ]};
}
test("Europe/Madrid day length handles spring forward, autumn back and normal day",()=>{
  assert.equal(slots.length,24);
  assert.equal(E.daySlots("2026-03-29").length,23);
  const back=E.daySlots("2026-10-25");
  assert.equal(back.length,25);
  assert.equal(back.filter(x=>x.label==="02:00").length,2);
  assert.notEqual(back.filter(x=>x.label==="02:00")[0].offset,back.filter(x=>x.label==="02:00")[1].offset);
  assert.throws(()=>E.daySlots("2026-02-30"),/Invalid calendar date/);
});
test("numeric validation handles Spanish decimal comma and bounded prices",()=>{
  assert.equal(E.amount("0,1524",-2,10,"rate"),.1524);
  assert.throws(()=>E.amount("Infinity",-2,10,"rate"),/number/);
  assert.throws(()=>E.amount("1e400",-2,10,"rate"),/number/);
  assert.throws(()=>E.amount("1000",-2,10,"rate"),/between/);
  assert.throws(()=>E.amount("0.01<script>",-2,10,"rate"),/number/);
});
test("manual 24-hour series maps each price to a unique Spanish civil hour",()=>{
  const d=E.manual(prices.join("\n"),date);
  assert.equal(d.rows.length,24);assert.equal(d.rows[0].price,.2);
  assert.equal(d.rows[0].utc,slots[0].utc);
  assert.equal(d.source,"Manual hourly values");
  assert.throws(()=>E.manual(prices.slice(1).join("\n"),date),/Expected 24/);
});
test("manual import supports 23/25-hour daylight saving days and safe bounds",()=>{
  assert.equal(E.manual(Array(23).fill("0.1").join("\n"),"2026-03-29").rows.length,23);
  assert.equal(E.manual(Array(25).fill("0.1").join("\n"),"2026-10-25").rows.length,25);
  assert.throws(()=>E.manual(Array(24).fill("0.1").join("\n"),"2026-10-25"),/Expected 25/);
  assert.throws(()=>E.manual("0.1\n".repeat(6000),date),/too large/);
});
test("PVPC REData JSON selects only series 1001 and converts €/MWh to €/kWh",()=>{
  const f=fixture(),d=E.official(f,date);
  assert.equal(d.rows.length,24);
  assert.equal(d.rows[0].price,0.1);
  assert.equal(d.rows[23].price,0.123);
  assert.match(d.source,/1001/);
  assert.equal(d.updated,"2026-11-21T20:20:00+01:00");
  assert.notEqual(d.rows[0].price,0.001);
});
test("PVPC import refuses missing/duplicate series, duplicates, spot-only or inconsistent hours",()=>{
  let f=fixture();f.included=f.included.filter(x=>x.id!=="1001");
  assert.throws(()=>E.official(f,date),/1001/);
  f=fixture();f.included.push(f.included[1]);assert.throws(()=>E.official(f,date),/ambiguous/);
  f=fixture();f.included[1].attributes.values[1].datetime=f.included[1].attributes.values[0].datetime;
  assert.throws(()=>E.official(f,date),/Duplicate/);
  f=fixture();f.included[1].attributes.values[0].datetime="2026-11-19T23:00:00+01:00";
  assert.throws(()=>E.official(f,date),/Missing hour/);
  assert.throws(()=>E.official({},"2026-11-21"),/included/);
});
test("PVPC indicator rejects malicious values, nonhour timestamps and bad update stamps",()=>{
  let f=fixture();f.included[1].attributes.values[0].value="100";assert.throws(()=>E.official(f,date),/Invalid PVPC/);
  f=fixture();f.included[1].attributes.values[0].value=Infinity;assert.throws(()=>E.official(f,date),/Invalid PVPC/);
  f=fixture();f.included[1].attributes.values[0].datetime="2026-11-21T00:30:00+01:00";assert.throws(()=>E.official(f,date),/Invalid hourly timestamp/);
  f=fixture();f.data.attributes["last-update"]="not a timestamp";assert.throws(()=>E.official(f,date),/update timestamp/);
});
test("constant draw cost window optimization and fixed tariff comparison are deterministic",()=>{
  const x=prices.slice();
  x[2]="0.05";x[3]="0.05";x[5]="0.40";x[6]="0.40";
  const d=E.manual(x.join("\n"),date);
  const cost=E.calculate(d,"2","2","0.18");
  assert.equal(cost.best.start,2);assert.equal(cost.worst.start,5);
  assert.equal(cost.best.price,.2);assert.equal(cost.worst.price,1.6);
  assert.equal(cost.savings,1.4);assert.equal(cost.fixedCost,.72);
  assert.equal(cost.kwh,4);assert.equal(cost.windowCount,23);
});
test("runtime and power bounds reject physically invalid configurations",()=>{
  const d=E.manual(prices.join("\n"),date);
  assert.throws(()=>E.calculate(d,0,2,""),/between/);
  assert.throws(()=>E.calculate(d,2,1.5,""),/whole hours/);
  assert.throws(()=>E.calculate(d,2,7,""),/between/);
  assert.throws(()=>E.calculate(d,2,2,-5),/between/);
});
test("fictional demo cannot be mistaken for official or current pricing",()=>{
  const d=E.example(date);
  assert.equal(d.rows.length,24);
  assert.match(d.source,/SYNTHETIC DEMO/);
  assert.notEqual(d.updated,"2026-11-21");
});
test("CSV export includes provenance but no scripts, file uploads or private details",()=>{
  const data=E.manual(prices.join("\n"),date);
  const csv=E.csv(data);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv,/Manual hourly values/);
  assert.equal(csv.split("\r\n").filter(Boolean).length,25);
  data.source="=HYPERLINK(1)";
  assert.match(E.csv(data),/'=HYPERLINK/);
  assert.throws(()=>E.csv(null),/No data/);
});
test("official URL is explicit, date-scoped and points only to REData GET",()=>{
  const url=E.officialURL(date);
  assert.match(url,/^https:\/\/apidatos\.ree\.es\/es\/datos\/mercados\/precios-mercados-tiempo-real\?/);
  assert.match(url,/start_date=2026-11-21T00%3A00/);
  assert.match(url,/end_date=2026-11-21T23%3A59/);
});