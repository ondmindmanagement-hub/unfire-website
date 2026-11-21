(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PrivacyLensEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_CHARACTERS = 200000;
  const TYPES = Object.freeze([
    {id:"secret",label:"Possible access tokens",replacement:"[POSSIBLE TOKEN REDACTED]",priority:0},
    {id:"iban",label:"Valid-format IBANs",replacement:"[IBAN REDACTED]",priority:1},
    {id:"identity",label:"Spanish DNI / NIE",replacement:"[ID REDACTED]",priority:2},
    {id:"email",label:"Email addresses",replacement:"[EMAIL REDACTED]",priority:3},
    {id:"phone",label:"Spanish phone numbers",replacement:"[PHONE REDACTED]",priority:4},
    {id:"ip",label:"IPv4 addresses",replacement:"[IP ADDRESS REDACTED]",priority:5}
  ]);
  const byId = Object.fromEntries(TYPES.map(x=>[x.id,x]));
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  const countryLengths={ES:24,GB:22,DE:22,FR:27,IT:27,NL:18,BE:16,PT:25,IE:22,AT:20,CH:21};
  function validDni(value) {
    const v=String(value).toUpperCase();
    if (!/^(?:[0-9]{8}|[XYZ][0-9]{7})[A-Z]$/.test(v)) return false;
    const raw = /^[XYZ]/.test(v) ? ({X:"0",Y:"1",Z:"2"}[v[0]]+v.slice(1,8)) : v.slice(0,8);
    return letters[Number(raw)%23]===v[8];
  }
  function validIban(value) {
    const v=String(value).toUpperCase().replace(/[\s-]/g,"");
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(v)||v.length<15||v.length>34) return false;
    const expected=countryLengths[v.slice(0,2)];
    if (expected&&v.length!==expected) return false;
    const moved=v.slice(4)+v.slice(0,4);
    let rem=0;
    for (const char of moved) {
      const code=char.charCodeAt(0);
      const digits=code>=65&&code<=90?String(code-55):char;
      for (const d of digits) rem=(rem*10+Number(d))%97;
    }
    return rem===1;
  }
  function validIPv4(value) {
    return value.split(".").length===4&&value.split(".").every(x=>/^\d{1,3}$/.test(x)&&Number(x)<=255);
  }
  function scan(text, enabled) {
    if (typeof text!=="string") throw new Error("Text must be a string.");
    if (text.length>MAX_CHARACTERS) throw new Error("Text is too long. Use 200,000 characters or fewer.");
    const active = enabled===undefined ? new Set(TYPES.map(x=>x.id)) : new Set(enabled);
    const found=[];
    function push(type,start,value){
      if (found.length>=5000) return;
      found.push({type,start,end:start+value.length,priority:byId[type].priority});
    }
    function all(type,re,validator,group=0) {
      if (!active.has(type)) return;
      re.lastIndex=0;
      let m, attempts=0;
      while ((m=re.exec(text))!==null&&attempts++<6000) {
        const v=m[group];
        if (v&&(!validator||validator(v))) {
          const at=m.index+(group===0?0:m[0].indexOf(v));
          push(type,at,v);
        }
        if (m[0].length===0) re.lastIndex++;
      }
    }
    all("secret",/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g);
    all("secret",/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g);
    all("secret",/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g);
    all("secret",/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g);
    all("secret",/\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g);
    all("iban",/\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/gi,validIban);
    all("iban",/\b[A-Z]{2}[0-9]{2}(?:[ -]?[A-Z0-9]{4}){3,8}\b/gi,validIban);
    all("identity",/\b(?:[0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])\b/gi,validDni);
    all("email",/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi);
    all("phone",/(^|[^A-Za-z0-9])((?:\+34[ -]?)?[6789][0-9]{2}[ -]?[0-9]{3}[ -]?[0-9]{3})(?![A-Za-z0-9])/gm,null,2);
    all("ip",/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,validIPv4);

    found.sort((a,b)=>a.start-b.start||a.priority-b.priority||(b.end-a.end));
    const matches=[];
    let lastEnd=0;
    for(const f of found) {
      if(f.start<lastEnd)continue;
      matches.push({type:f.type,start:f.start,end:f.end});
      lastEnd=f.end;
    }
    return matches;
  }
  function redact(text, matches) {
    if(typeof text!=="string"||!Array.isArray(matches))throw new Error("Invalid input.");
    let out="",last=0;
    for(const match of matches) {
      if(!byId[match.type]||!Number.isInteger(match.start)||!Number.isInteger(match.end)||
        match.start<last||match.end<=match.start||match.end>text.length)
        throw new Error("Invalid redaction range.");
      out+=text.slice(last,match.start)+byId[match.type].replacement;
      last=match.end;
    }
    return out+text.slice(last);
  }
  function report(text,enabled) {
    const matches=scan(text,enabled);
    const counts=Object.fromEntries(TYPES.map(t=>[t.id,0]));
    matches.forEach(m=>counts[m.type]++);
    return {counts,matches,redacted:redact(text,matches)};
  }
  return {MAX_CHARACTERS,TYPES,validDni,validIban,validIPv4,scan,redact,report};
});
