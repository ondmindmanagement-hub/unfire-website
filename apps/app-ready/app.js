(function(){
"use strict";
const E=window.AppReadyEngine,$=id=>document.getElementById(id);
if(!E)throw Error("App Ready engine unavailable");
const sections=["Product & testing","Listing & media","Privacy & compliance","App Review readiness","Rights & business"];
let state=E.blankState("macos"),filter="all",taskNodes=[];
const ui={app:$("app-name"),platform:$("platform"),export:$("export"),import:$("import"),reset:$("reset"),done:$("done"),pending:$("pending"),na:$("na"),progress:$("progress"),percent:$("progress-text"),progressNote:$("progress-note"),live:$("live-status"),tasks:$("task-sections"),filter:$("filter"),empty:$("empty-filter")};
function message(text,error){ui.live.textContent=text;ui.live.style.color=error?"#ffd1be":"";}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function renderTasks(){
 ui.tasks.replaceChildren();taskNodes=[];
 for(const section of sections){
  const items=E.activeTasks(state.platform).filter(t=>t.section===section);
  if(!items.length)continue;
  const group=el("section","task-group");
  const groupId="group-"+section.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  group.setAttribute("aria-labelledby",groupId);
  const head=el("div","group-header"),heading=el("h3","",section),count=el("span","",items.length+" REVIEW ITEMS");
  heading.id=groupId;head.append(heading,count);group.appendChild(head);
  for(const task of items){
   const item=el("div","item");item.dataset.id=task.id;
   const details=el("div","item-details"),title=el("h4","",task.title);title.id="check-"+task.id;
   details.append(title,el("p","",task.detail));
   if(task.optional)details.appendChild(el("span","tag","CONDITIONAL · N/A ALLOWED"));
   const ctrl=el("div","item-control"),label=el("label","","Status"),select=el("select","");
   select.id="answer-"+task.id;label.htmlFor=select.id;select.setAttribute("aria-describedby",title.id);
   for(const [value,display] of [["pending","Needs attention"],["checked","Checked"],["na","Not applicable"]]){
    if(value==="na"&&!task.optional)continue;
    const option=el("option","",display);option.value=value;select.appendChild(option);
   }
   const current=state.answers[task.id];
   select.value=E.canUseState(task.id,current,state.platform)?current:"pending";
   item.dataset.status=select.value;
   select.addEventListener("change",function(){
    E.setAnswer(state,task.id,select.value);item.dataset.status=select.value;
    refresh();message("Updated "+task.title+". This is your self-reported status.");
   });
   ctrl.append(label,select);item.append(details,ctrl);group.appendChild(item);
   taskNodes.push({item,group,task});
  }
  ui.tasks.appendChild(group);
 }
 refresh();
}
function applyFilter(){
 let shown=0;const groups=new Map();
 for(const x of taskNodes){
  const visible=filter==="all"||filter===x.item.dataset.status;
  x.item.hidden=!visible;groups.set(x.group,(groups.get(x.group)||0)+Number(visible));
  if(visible)shown++;
 }
 for(const [group,count] of groups)group.hidden=count===0;
 ui.empty.hidden=shown!==0;
}
function refresh(){
 const stats=E.stats(state);
 ui.done.textContent=String(stats.done);ui.pending.textContent=String(stats.pending);ui.na.textContent=String(stats.na);
 ui.percent.textContent=stats.percent+"%";ui.progress.value=stats.percent;ui.progress.textContent=stats.percent+"%";
 ui.progressNote.textContent=stats.complete?"All applicable items self-marked. This does not certify compliance or guarantee approval.":stats.pending+" items still require your review. Nothing is verified automatically.";
 applyFilter();
}
ui.platform.addEventListener("change",function(){
 try{
  state=E.blankState(ui.platform.value,E.cleanName(ui.app.value));
  ui.filter.value="all";filter="all";renderTasks();
  message("Platform changed. Review statuses reset to avoid carrying over checks from another platform.");
 }catch(e){message(e.message,true);}
});
ui.app.addEventListener("input",function(){
 try{state.appName=E.cleanName(ui.app.value);message("App name updated locally. Nothing has been saved or sent.");}
 catch(e){message(e.message,true);}
});
ui.filter.addEventListener("change",function(){filter=ui.filter.value;applyFilter();});
ui.export.addEventListener("click",function(){
 try{
  state.appName=E.cleanName(ui.app.value);
  const report=E.makeReport(state),blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download=E.safeFilename(state.appName);
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},10000);
  message("JSON review downloaded locally. It may contain the app name; inspect before sharing.");
 }catch(e){message(e.message||"Unable to export review.",true);}
});
ui.import.addEventListener("change",function(){
 const file=ui.import.files&&ui.import.files[0];
 if(!file)return;ui.import.value="";
 if(!/\.json$/i.test(file.name)){message("Choose an App Ready JSON export.",true);return;}
 if(file.size>E.MAX_FILE_BYTES){message("JSON export exceeds 64 KB. Nothing was imported.",true);return;}
 const reader=new FileReader();
 reader.onload=function(){
  try{
   state=E.loadReport(reader.result);
   ui.app.value=state.appName;ui.platform.value=state.platform;ui.filter.value="all";filter="all";
   renderTasks();message("Saved review loaded locally. Verify each status before relying on it.");
  }catch(e){message(e.message||"Unable to import this review.",true);}
 };
 reader.onerror=function(){message("Unable to read selected file.",true);};
 reader.readAsText(file,"UTF-8");
});
ui.reset.addEventListener("click",function(){
 if(!window.confirm("Clear all self-reported checklist statuses? Export your review first if you need a copy."))return;
 state=E.blankState(ui.platform.value);ui.app.value="";ui.filter.value="all";filter="all";
 renderTasks();message("Review cleared from this tab. Existing downloads remain separate.");
});
renderTasks();message("Ready. Mark only checks you've actually completed.");
})();
