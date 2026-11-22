(function(root,factory){
"use strict";
const api=factory();
if(typeof module==="object"&&module.exports)module.exports=api;
root.AppReadyEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const SCHEMA_VERSION=1, MAX_FILE_BYTES=65536;
const PLATFORMS=Object.freeze(["ios","ipados","macos"]);
const STATES=Object.freeze(["pending","checked","na"]);
const TASKS=Object.freeze([
 {id:"real-device",section:"Product & testing",title:"Test a release build on supported devices",detail:"Confirm critical flows on real compatible devices, not only in screenshots or simulators."},
 {id:"crashes",section:"Product & testing",title:"Review stability and crash paths",detail:"Check start-up, common workflows, errors, repeated use and unexpected termination."},
 {id:"edge-cases",section:"Product & testing",title:"Check permissions, empty states and offline behavior",detail:"Verify that denied permissions, connectivity loss and malformed inputs fail safely."},
 {id:"accessibility",section:"Product & testing",title:"Review accessibility on device",detail:"Check screen readers, keyboard or Switch Control where relevant, focus and text legibility."},
 {id:"release-build",section:"Listing & media",title:"Select the correct platform version and build",detail:"Cross-check the uploaded build, version and features against the actual binary."},
 {id:"metadata",section:"Listing & media",title:"Use accurate names, descriptions and promotional text",detail:"Remove placeholders, unsupported features, out-of-date prices and misleading claims."},
 {id:"screens-ios",section:"Listing & media",title:"Use genuine screenshots for the required iPhone size",detail:"Capture the current iOS build in use, with the correct localization.",platform:"ios"},
 {id:"screens-ipados",section:"Listing & media",title:"Use genuine screenshots for the required iPad size",detail:"Capture the current iPadOS build in use, with the correct localization.",platform:"ipados"},
 {id:"screens-macos",section:"Listing & media",title:"Use genuine Mac screenshots for the listing",detail:"Confirm screenshots reflect the current macOS release build.",platform:"macos"},
 {id:"icon-assets",section:"Listing & media",title:"Check icons, visuals and asset ownership",detail:"Confirm app icon, brand imagery and previews are genuine, readable and properly licensed."},
 {id:"support-url",section:"Listing & media",title:"Verify live support and privacy-policy URLs",detail:"Open the real links and confirm accurate contact information and accessible policy text."},
 {id:"privacy-declarations",section:"Privacy & compliance",title:"Compare App Privacy answers with actual behavior",detail:"Review collection, third-party SDKs, sharing, tracking and retention against implementation."},
 {id:"purpose-strings",section:"Privacy & compliance",title:"Review permission purpose strings if relevant",detail:"Check declared microphone, camera, location and other sensitive access.",optional:true},
 {id:"age-rating",section:"Privacy & compliance",title:"Complete the current age-rating questionnaire",detail:"Answer honestly based on the app's real content and functionality."},
 {id:"encryption",section:"Privacy & compliance",title:"Review export-compliance questions",detail:"Determine whether encryption declarations or exemptions apply; do not guess legal conclusions."},
 {id:"review-notes",section:"App Review readiness",title:"Write specific reviewer notes",detail:"Explain changes, non-obvious workflows, important dependencies and any review setup."},
 {id:"review-access",section:"App Review readiness",title:"Provide legitimate review access if needed",detail:"Prepare a demo account or approved demo mode without putting passwords into this tool.",optional:true},
 {id:"external-dependencies",section:"App Review readiness",title:"Validate required services, devices and sample content",detail:"Ensure reviewers can exercise core functionality or have appropriate instructions.",optional:true},
 {id:"rights",section:"Rights & business",title:"Confirm rights to code, media and third-party assets",detail:"Verify licenses, dependencies, trademarks and permitted redistribution."},
 {id:"in-app-purchases",section:"Rights & business",title:"Verify in-app purchases or subscriptions if used",detail:"Check that configured paid items work and can be reviewed, and disclosures are accurate.",optional:true},
 {id:"availability",section:"Rights & business",title:"Confirm final pricing, regions and release setting",detail:"Review the planned distribution and avoid claiming availability before it is confirmed."}
].map(x=>Object.freeze(x)));
const TASK_MAP=Object.assign(Object.create(null),Object.fromEntries(TASKS.map(x=>[x.id,x])));
function platformValid(platform){return PLATFORMS.includes(platform);}
function activeTasks(platform){
 if(!platformValid(platform))throw Error("Choose a supported platform.");
 return TASKS.filter(t=>!t.platform||t.platform===platform);
}
function blankState(platform="macos",appName=""){
 if(!platformValid(platform))throw Error("Unsupported platform.");
 return {platform,appName:cleanName(appName),answers:Object.create(null)};
}
function cleanName(name){
 if(typeof name!=="string")throw Error("App name must be text.");
 if(/[\u0000-\u001f\u007f]/.test(name))throw Error("App name contains control characters.");
 const trimmed=name.trim().replace(/\s+/g," ");
 if(trimmed.length>80)throw Error("App name is limited to 80 characters.");
 if(/[\u0000-\u001f\u007f]/.test(trimmed))throw Error("App name contains control characters.");
 return trimmed;
}
function canUseState(taskId,status,platform){
 if(!platformValid(platform)||!STATES.includes(status))return false;
 const task=TASK_MAP[taskId];
 return Boolean(task&&(!task.platform||task.platform===platform)&&(status!=="na"||task.optional));
}
function setAnswer(state,id,status){
 if(!canUseState(id,status,state.platform))throw Error("Unsupported status for this review item.");
 state.answers[id]=status;
 return state;
}
function stats(state){
 const tasks=activeTasks(state.platform);
 const done=tasks.filter(t=>state.answers[t.id]==="checked").length;
 const na=tasks.filter(t=>t.optional&&state.answers[t.id]==="na").length;
 const outstanding=tasks.filter(t=>!["checked","na"].includes(state.answers[t.id])||state.answers[t.id]==="na"&&!t.optional);
 const applicable=tasks.length-na;
 return {total:tasks.length,done,na,applicable,pending:outstanding.length,
         percent:applicable>0?Math.floor(done/applicable*100):0,
         complete:applicable>0&&outstanding.length===0};
}
function makeReport(state,clock=new Date()){
 const reportStats=stats(state);
 const answers=Object.create(null);
 for(const task of activeTasks(state.platform)){
  answers[task.id]=canUseState(task.id,state.answers[task.id],state.platform)?state.answers[task.id]:"pending";
 }
 const generatedAt=clock instanceof Date&&Number.isFinite(clock.getTime())?clock.toISOString():null;
 if(!generatedAt)throw Error("Invalid timestamp.");
 return {
  schema_version:SCHEMA_VERSION,
  document_type:"unfire-app-ready-self-review",
  created_at:generatedAt,
  app_name:cleanName(state.appName),
  platform:state.platform,
  checks:answers,
  summary:{checked:reportStats.done,not_applicable:reportStats.na,pending:reportStats.pending,total:reportStats.total},
  warning:"Self-reported checklist only; no automated Apple validation, submission, approval or compliance certification."
 };
}
function loadReport(text){
 if(typeof text!=="string"||new TextEncoder().encode(text).byteLength>MAX_FILE_BYTES)throw Error("Review file is too large.");
 let data;
 try{data=JSON.parse(text);}catch(e){throw Error("File is not valid JSON.");}
 if(!data||typeof data!=="object"||Array.isArray(data)||data.schema_version!==SCHEMA_VERSION||
 data.document_type!=="unfire-app-ready-self-review"||!platformValid(data.platform)||
 !data.checks||typeof data.checks!=="object"||Array.isArray(data.checks))
   throw Error("Not a supported App Ready review export.");
 const state=blankState(data.platform,cleanName(data.app_name||""));
 const checkKeys=Object.keys(data.checks);
 if(checkKeys.length>100)throw Error("Unexpected number of checks.");
 for(const id of checkKeys){
  if(!Object.prototype.hasOwnProperty.call(TASK_MAP,id))throw Error("Unknown check in review file.");
  if(!canUseState(id,data.checks[id],data.platform))throw Error("Invalid check state.");
  state.answers[id]=data.checks[id];
 }
 return state;
}
function safeFilename(appName){
 const base=cleanName(appName||"app").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^A-Za-z0-9 -]/g,"").trim().replace(/\s+/g,"-").slice(0,44)||"app";
 return "unfire-app-ready-"+base+".json";
}
return {SCHEMA_VERSION,MAX_FILE_BYTES,PLATFORMS,STATES,TASKS,activeTasks,blankState,cleanName,canUseState,setAnswer,stats,makeReport,loadReport,safeFilename};
});
