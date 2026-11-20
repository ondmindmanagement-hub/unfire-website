(function(root){'use strict';
const cases=[
  {
    "id": "SIM-001",
    "channel": "Sensor report",
    "description": "Refrigeration failure: unsafe temperature reported by a fictional kiosk.",
    "requestedAction": "update_record"
  },
  {
    "id": "SIM-002",
    "channel": "Email",
    "description": "A fictional buyer claims the payment was double charged and requests a refund.",
    "requestedAction": "refund"
  },
  {
    "id": "SIM-003",
    "channel": "Support portal",
    "description": "Vending unit offline after a network failure.",
    "requestedAction": "update_record"
  },
  {
    "id": "SIM-004",
    "channel": "Inventory alert",
    "description": "Low stock of bottled water; routine restock may be needed.",
    "requestedAction": "draft_note"
  },
  {
    "id": "SIM-005",
    "channel": "Website form",
    "description": "The request contains a placeholder phone number; staff asks to export personal data.",
    "requestedAction": "export_personal_data"
  },
  {
    "id": "SIM-006",
    "channel": "Operator note",
    "description": "Duplicate incident opened for a jammed dispenser.",
    "requestedAction": "update_record"
  },
  {
    "id": "SIM-007",
    "channel": "Email",
    "description": "Unclear incident without a recognized symptom.",
    "requestedAction": "update_record"
  },
  {
    "id": "SIM-008",
    "channel": "Telemetry",
    "description": "Fictional machine is overheating and reports smoke.",
    "requestedAction": "draft_note"
  }
];
const evaluate=function evaluate(item){
  const t=String(item.description||"").toLowerCase();
  const action=String(item.requestedAction||"draft_note").toLowerCase();
  let priority="Normal", reason="No defined severity cue; request a reviewer to confirm classification.";
  if(/smoke|fire|electric shock|unsafe temperature|overheat|refrigeration failure/.test(t)){
    priority="Critical"; reason="Potential equipment or product safety cue; escalate for human assessment.";
  }else if(/outage|offline|unreachable|network failure|payment failure|double charg/.test(t)){
    priority="High";reason="Service disruption or financial discrepancy cue requires priority review.";
  }else if(/duplicate|stuck|jammed|blocked|unresolved|incorrect status/.test(t)){
    priority="Medium";reason="Repeated or inconsistent operational state requires investigation.";
  }else if(/restock|low stock|routine inspection/.test(t)){
    priority="Low";reason="Routine informational case, without detected higher-priority cues.";
  }
  let decision="REVIEW REQUIRED";
  let policy="A human must approve any change to an external system.";
  if(action==="refund"||action==="export_personal_data"){
    decision="BLOCKED";policy="Financial action or personal-data export is not permitted by this demonstration.";
  }else if(action==="draft_note"){
    decision="DRAFT ONLY";policy="A read-only note can be drafted locally; no records are changed.";
  }else if(action!=="update_record"){
    decision="BLOCKED";policy="Unknown requested action is denied by default.";
  }
  if(/phone number|home address|payment card|personal data/.test(t)){
    policy+=" Potentially sensitive content flagged for manual handling; do not copy real data.";
  }
  return {id:String(item.id||"UNKNOWN"),priority,reason,decision,policy,executed:false,externalCalls:0};
};
const api={cases,evaluate};
if(typeof module==='object'&&module.exports)module.exports=api;
root.UnfireTriage=api;
})(typeof globalThis!=='undefined'?globalThis:this);
