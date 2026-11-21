import { researchTemplate, planAgentWaves } from "./superchat.mjs";

const $ = id => document.getElementById(id);
const columns = ["discover","build","verify","deliver"];
const names = {
  sources:"Source researcher",challenge:"Critical challenger",technical:"Technical analyst",
  evidence:"Evidence verifier",synthesis:"Synthesis editor",quality:"Quality auditor",
  release:"Release coordinator"
};
const input = $("goal"), slots = $("concurrency");
const approvals = [$("approve-synthesis"),$("approve-release")];
let plan = null, tasks = [], nextWave = 0, stopped = false, completed = new Set();
const log = [];

function event(message) {
  log.unshift({ time:new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),message });
  const root = $("events");
  root.replaceChildren();
  for (const item of log.slice(0,20)) {
    const row=document.createElement("div");row.className="event";
    const time=document.createElement("span");time.textContent=item.time;
    const text=document.createElement("b");text.textContent=item.message;
    row.append(time,text);root.append(row);
  }
}
function makeCard(task, scheduled, blocked) {
  const card=document.createElement("article");
  const state=stopped&&!completed.has(task.id)?"stopped":
    completed.has(task.id)?"simulated":blocked?"blocked":scheduled?"planned":"blocked";
  card.className="agent";
  card.dataset.state=state;
  const head=document.createElement("div");head.className="head";
  const title=document.createElement("b");title.textContent=names[task.id]??task.role;
  const kind=document.createElement("span");kind.className="kind";
  kind.textContent=task.kind==="read"?"Read only":task.kind==="write"?"Write gate":"Release gate";
  head.append(title,kind);
  const role=document.createElement("div");role.className="role";
  role.textContent="Role: "+task.role+" · Dependencies: "+(task.dependsOn.join(", ") || "none");
  const indicator=document.createElement("div");indicator.className="state";
  indicator.textContent=state==="simulated"?"Simulated complete":state==="stopped"?"Stopped":
    state==="blocked"?"Awaiting authorization/dependency":"Scheduled";
  card.append(head,role,indicator);
  return card;
}
function render() {
  const scheduled = new Set(plan?.waves.flatMap(w=>w.map(t=>t.id)) ?? []);
  const blocked = new Set(plan?.blocked ?? []);
  for (const lane of columns) {
    const root=$("cards-"+lane);root.replaceChildren();
    const laneTasks=tasks.filter(t=>t.lane===lane);
    for (const task of laneTasks) root.append(makeCard(task,scheduled.has(task.id),blocked.has(task.id)));
    $("count-"+lane).textContent=laneTasks.length;
  }
  $("metric-roles").textContent=tasks.length;
  $("metric-slots").textContent=plan?.concurrency??slots.value;
  $("metric-waves").textContent=plan?.waves.length??0;
  $("summary").textContent=tasks.length+" roles · "+completed.size+" simulated · "+(plan?.blocked.length??0)+" blocked";
  $("advance").disabled=stopped||!plan||nextWave>=plan.waves.length;
}
function makePlan() {
  try {
    tasks=researchTemplate(input.value);
    const approved=[];
    if(approvals[0].checked) approved.push("synthesis");
    if(approvals[1].checked) approved.push("release");
    plan=planAgentWaves(tasks,{concurrency:Number(slots.value),approved});
    nextWave=0;completed=new Set();stopped=false;
    const msg="Planned "+plan.scheduled+"/"+plan.total+" virtual steps in "+plan.waves.length+" waves. "+
      plan.blocked.length+" await authorization or dependencies.";
    $("feedback").textContent=msg;
    event("Mission planned. "+msg);
  } catch(error) {
    $("feedback").textContent="Cannot plan: "+error.message;
    event("Plan validation rejected: "+error.message);
    plan=null;tasks=[];nextWave=0;completed=new Set();
  }
  render();
}
function advance() {
  if(!plan||stopped||nextWave>=plan.waves.length)return;
  const wave=plan.waves[nextWave];
  for(const task of wave) completed.add(task.id);
  nextWave++;
  event("Simulated wave "+nextWave+": "+wave.map(t=>names[t.id]??t.role).join(" · "));
  $("feedback").textContent="Simulated "+completed.size+" of "+tasks.length+" steps. No real agents executed.";
  if(nextWave===plan.waves.length) event(plan.blocked.length?
    "Simulation paused at authorization gates. Re-plan with approval to continue.":
    "All permitted stages simulated. This is NOT a real-world task completion.");
  render();
}
function stop() {
  stopped=true;
  $("feedback").textContent="STOP applied. No further simulation steps can advance until a new plan is created.";
  event("STOP requested. Subsequent waves blocked.");
  render();
}
function reset() {
  approvals.forEach(c=>c.checked=false);
  slots.value="3";
  input.value="Compare secure multi-agent workflow designs for Unfire OS";
  plan=null;tasks=[];completed=new Set();nextWave=0;stopped=false;log.length=0;
  $("feedback").textContent="Reset complete. Nothing was executed or saved.";
  $("events").replaceChildren();
  makePlan();
}
$("plan").addEventListener("click",makePlan);
$("advance").addEventListener("click",advance);
$("stop").addEventListener("click",stop);
$("reset").addEventListener("click",reset);
makePlan();
