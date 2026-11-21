(function () {
  "use strict";
  const E=window.PrivacyLensEngine;
  const $=id=>document.getElementById(id);
  const ui={input:$("input"),output:$("output"),file:$("file"),cats:$("categories"),
    analyze:$("analyze"),clear:$("clear"),copy:$("copy"),download:$("download"),
    chars:$("chars"),total:$("total"),counts:$("counts"),chip:$("result-chip"),status:$("status")};
  let result=null,sourceFilename="";
  function setStatus(message,error=false){
    ui.status.textContent=message;
    ui.status.style.color=error?"#ffb7bd":"";
  }
  function setReady(){
    ui.chars.textContent=ui.input.value.length.toLocaleString("en-US")+" / "+E.MAX_CHARACTERS.toLocaleString("en-US");
    const exceeded=ui.input.value.length>E.MAX_CHARACTERS;
    ui.analyze.disabled=exceeded;
    if(exceeded)setStatus("Text exceeds 200,000 characters. Shorten it before analyzing.",true);
  }
  function invalidate(){
    result=null;
    ui.output.value="";
    ui.copy.disabled=true;
    ui.download.disabled=true;
    ui.total.textContent="—";
    ui.counts.textContent="";
    ui.chip.textContent="NOT ANALYZED";
    setReady();
    if(ui.input.value.length<=E.MAX_CHARACTERS)
      setStatus("Content or filters changed. Run Analyze & redact to update the result.");
  }
  E.TYPES.forEach(function(type){
    const label=document.createElement("label");
    label.className="category";
    const box=document.createElement("input");
    box.type="checkbox";box.value=type.id;box.checked=true;box.name="pattern-type";
    box.addEventListener("change",invalidate);
    const span=document.createElement("span");span.textContent=type.label;
    label.append(box,span);ui.cats.appendChild(label);
  });
  function selected(){
    return Array.from(ui.cats.querySelectorAll('input[type="checkbox"]:checked')).map(x=>x.value);
  }
  ui.input.addEventListener("input",invalidate);
  ui.file.addEventListener("change",function(){
    const file=ui.file.files&&ui.file.files[0];
    if(!file)return;
    if(!/\.(?:txt|md|csv|json)$/i.test(file.name)){
      setStatus("Only UTF-8 TXT, MD, CSV and JSON text files are supported.",true);ui.file.value="";return;
    }
    if(file.size>512*1024){
      setStatus("File exceeds 512 KB. No content was loaded.",true);ui.file.value="";return;
    }
    const reader=new FileReader();
    reader.onload=function(){
      ui.file.value="";
      if(typeof reader.result!=="string"){setStatus("The file could not be read as text.",true);return;}
      if(reader.result.includes("\u0000")){
        setStatus("This appears to be a binary file; nothing was loaded.",true);return;
      }
      if(reader.result.length>E.MAX_CHARACTERS){
        setStatus("File contains too many characters. Nothing was loaded.",true);return;
      }
      ui.input.value=reader.result;
      sourceFilename=file.name;
      invalidate();
      setStatus("File loaded locally. Run Analyze & redact before sharing.");
    };
    reader.onerror=function(){ui.file.value="";setStatus("Cannot read this local file.",true);};
    reader.readAsText(file,"UTF-8");
  });
  ui.analyze.addEventListener("click",function(){
    const text=ui.input.value;
    if(!text.trim()){setStatus("Enter or load text first.",true);return;}
    if(text.length>E.MAX_CHARACTERS){setStatus("Text is too long.",true);return;}
    const chosen=selected();
    if(!chosen.length){setStatus("Choose at least one pattern category.",true);return;}
    try{
      result=E.report(text,chosen);
      const n=result.matches.length;
      ui.output.value=result.redacted;
      ui.total.textContent=String(n);
      ui.chip.textContent=n?"REVIEW REDACTIONS":"NO PATTERNS DETECTED";
      ui.counts.textContent="";
      E.TYPES.forEach(function(t){
        const count=result.counts[t.id];
        if(!count)return;
        const bubble=document.createElement("span");
        bubble.className="count-bubble";
        bubble.textContent=t.label+" · "+count;
        ui.counts.appendChild(bubble);
      });
      ui.copy.disabled=n===0;ui.download.disabled=n===0;
      setStatus(n
        ? "Review the complete redacted copy. Hidden data may still remain."
        : "No selected patterns matched. This DOES NOT mean the text is safe to share.",
        n===0);
    }catch(e){invalidate();setStatus(e.message||"Local analysis failed.",true);}
  });
  ui.clear.addEventListener("click",function(){
    ui.input.value="";ui.file.value="";sourceFilename="";
    invalidate();
    setStatus("Cleared from this page. Browser and clipboard history may still exist.");
  });
  ui.copy.addEventListener("click",async function(){
    if(!result||result.matches.length===0)return;
    try{
      if(!navigator.clipboard||!navigator.clipboard.writeText)
        throw new Error("Clipboard is not available.");
      await navigator.clipboard.writeText(result.redacted);
      setStatus("Redacted text copied. Review before sending anywhere.");
    }catch(e){setStatus("Clipboard was not available. You can select the reviewed text manually.",true);}
  });
  ui.download.addEventListener("click",function(){
    if(!result||result.matches.length===0)return;
    const base=(sourceFilename||"privacy-lens").replace(/\.[^.]+$/,"")
      .normalize("NFKC").replace(/[^A-Za-z0-9 -_]/g,"").trim().replace(/\s+/g,"-").slice(0,50)||"privacy-lens";
    const blob=new Blob([result.redacted],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=base+"-redacted.txt";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},15000);
    setStatus("Redacted file prepared locally. Review before sharing.");
  });
  setReady();
})();
