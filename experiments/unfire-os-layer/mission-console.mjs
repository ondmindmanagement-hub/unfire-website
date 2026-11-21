const $ = name => document.getElementById(name);
const params = new URL(location.href);
const fromLink = params.hash.slice(1);
if (/^[a-f0-9]{64}$/u.test(fromLink)) sessionStorage.setItem("unfire-os-local-session",fromLink);
const token = fromLink || sessionStorage.getItem("unfire-os-local-session") || "";
history.replaceState(null,"",params.pathname);
let mission = null, stopped = false, connected = false, hasMission = false, claims = {};
function feedback(message,error=false) {
  const n = $("feedback"); n.textContent=message; n.dataset.error=error?"true":"false";
}
function updateButtons() {
  $("create").disabled=!connected || hasMission;
  $("stop").disabled=!connected || !hasMission || stopped;
  for(const b of ["claim","release","complete"]) $(b).disabled=!connected || !hasMission || stopped;
}
async function api(path,body) {
  if(!/^[a-f0-9]{64}$/u.test(token)) throw new Error("Session URL is missing its authorization token. Restart from the terminal link.");
  const headers={Authorization:"Bearer "+token};
  if(body!==undefined) headers["Content-Type"]="application/json";
  const r=await fetch(path,{
    method:body===undefined?"GET":"POST",headers,
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    cache:"no-store",credentials:"omit",redirect:"error"
  });
  const result=await r.json();
  if(!r.ok) throw new Error(result.error??"Operation failed");
  return result;
}
function renderRecords(records) {
  const root=$("records");root.replaceChildren();
  if(!records.length){
    const empty=document.createElement("div");empty.className="empty";empty.textContent="No events recorded.";
    root.append(empty);return;
  }
  for(const record of [...records].reverse().slice(0,30)) {
    const card=document.createElement("article");card.className="record";
    const h=document.createElement("b");
    h.textContent="#"+record.seq+" · "+record.event.type.replaceAll("_"," ");
    const details=document.createElement("small");
    details.textContent="Actor "+record.event.actor+" · "+
      (record.event.artifact?"Artifact "+record.event.artifact+" · ":"")+
      (record.event.task?"Task "+record.event.task+" · ":"")+
      "SHA-256 "+record.hash.slice(0,16)+"…";
    card.append(h,details);root.append(card);
  }
}
async function refresh() {
  try {
    const data=await api("/api/state");
    connected=true;
    mission=data.mission;
    hasMission=data.summary.mission!==null;
    stopped=data.summary.stopped;
    claims=data.summary.claims;
    $("connection").textContent="Local session · Connected";
    $("mission-label").textContent=mission;
    $("mission-state").textContent=stopped?"Stopped":hasMission?"Active":"New";
    $("event-count").textContent=data.records.length;
    $("claim-count").textContent=Object.keys(claims).length;
    renderRecords(data.records);
    feedback("Local journal read and integrity-checked. No agents are connected.");
    updateButtons();
  }catch(error){
    connected=false;
    $("connection").textContent="Local session · Locked";
    feedback(error.message,true);updateButtons();
  }
}
async function write(event) {
  try {
    await api("/api/events",event);
    await refresh();
  }catch(error){feedback(error.message,true);}
}
$("refresh").addEventListener("click",refresh);
$("create").addEventListener("click",()=>write({type:"MISSION_CREATED"}));
$("stop").addEventListener("click",()=>write({type:"MISSION_STOPPED"}));
$("claim").addEventListener("click",()=>write({type:"ARTIFACT_CLAIMED",artifact:$("artifact").value.trim()}));
$("release").addEventListener("click",()=>write({type:"ARTIFACT_RELEASED",artifact:$("artifact").value.trim()}));
$("complete").addEventListener("click",()=>write({type:"TASK_COMPLETED",task:$("task").value.trim()}));
refresh();
