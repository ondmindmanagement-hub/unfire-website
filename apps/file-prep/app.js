(function(){
 "use strict";
 const E=window.FilePrepEngine,$=id=>document.getElementById(id);
 const ui={src:$("source"),file:$("file"),mode:$("mode"),clean:$("clean-options"),
   json:$("json-options"),chunk:$("chunk-options"),trailing:$("trailing"),blank:$("blank"),
   outer:$("outer"),size:$("chunk-size"),overlap:$("overlap"),run:$("run"),clear:$("clear"),
   out:$("output"),copy:$("copy"),download:$("download"),sourceCount:$("source-count"),
   inputSize:$("in-size"),outputSize:$("out-size"),partSize:$("part-size"),
   resultChip:$("result-chip"),status:$("status")};
 let result=null,sourceFile="";
 function status(message,error){
   ui.status.textContent=message;
   ui.status.style.color=error?"#ffb4b9":"";
 }
 function invalidated(){
   result=null;ui.out.value="";
   ui.copy.disabled=true;ui.download.disabled=true;
   ui.inputSize.textContent="—";ui.outputSize.textContent="—";ui.partSize.textContent="—";
   ui.resultChip.textContent="NOT PROCESSED";
   ui.sourceCount.textContent=ui.src.value.length.toLocaleString("en-US")+" / "+E.MAX_CHARS.toLocaleString("en-US");
   ui.run.disabled=ui.src.value.length>E.MAX_CHARS;
   if(ui.run.disabled)status("Input exceeds 200,000 characters. Reduce it before processing.",true);
   else status("Source or settings changed. Click Prepare text to refresh.");
 }
 function modeUI(){
   ui.clean.hidden=ui.mode.value!=="clean";
   ui.json.hidden=ui.mode.value!=="json";
   ui.chunk.hidden=ui.mode.value!=="chunk";
   invalidated();
 }
 ui.mode.addEventListener("change",modeUI);
 ui.src.addEventListener("input",invalidated);
 for(const id of ["trailing","blank","outer","chunk-size","overlap"])
   $(id).addEventListener("input",invalidated);
 ui.file.addEventListener("change",function(){
   const file=ui.file.files&&ui.file.files[0];
   if(!file)return;
   if(!/\.(?:txt|md|csv|json)$/i.test(file.name)){
     ui.file.value="";status("Only local UTF-8 TXT, MD, CSV or JSON are supported.",true);return;
   }
   if(file.size>512*1024){ui.file.value="";status("File exceeds 512 KB. Nothing was loaded.",true);return;}
   const reader=new FileReader();
   reader.onload=function(){
     ui.file.value="";
     if(typeof reader.result!=="string"||reader.result.includes("\u0000")){
       status("This file is not readable plain text.",true);return;
     }
     if(reader.result.length>E.MAX_CHARS){
       status("File has too many characters. Nothing was loaded.",true);return;
     }
     ui.src.value=reader.result;sourceFile=file.name;invalidated();
     status("Local file loaded; no upload performed.");
   };
   reader.onerror=function(){ui.file.value="";status("Could not read the selected file.",true);};
   reader.readAsText(file,"UTF-8");
 });
 ui.run.addEventListener("click",function(){
   const src=ui.src.value;
   if(!src.trim()){status("Enter or load some text first.",true);return;}
   try{
     let output="",parts=1;
     switch(ui.mode.value){
       case "clean":
         output=E.clean(src,{trailing:ui.trailing.checked,blankLines:ui.blank.checked,trimOuter:ui.outer.checked});
         break;
       case "json":
         output=E.formatJson(src);
         break;
       case "chunk":{
         const chunks=E.chunk(src,Number(ui.size.value),Number(ui.overlap.value));
         parts=chunks.length;
         output=chunks.map(function(p){
           return "===== CHUNK "+p.number+" / "+chunks.length+" =====\n"+p.text;
         }).join("\n\n");
         break;
       }
       default:throw Error("Unknown output mode.");
     }
     result=output;
     ui.out.value=output;ui.inputSize.textContent=src.length.toLocaleString("en-US");
     ui.outputSize.textContent=output.length.toLocaleString("en-US");
     ui.partSize.textContent=String(parts);
     ui.resultChip.textContent="REVIEW OUTPUT";
     ui.copy.disabled=!output;ui.download.disabled=!output;
     status("Prepared entirely in your browser. Review the content before sharing.");
   }catch(e){
     invalidated();
     status(e.message||"Unable to prepare this text.",true);
   }
 });
 ui.clear.addEventListener("click",function(){
   ui.src.value="";ui.file.value="";sourceFile="";invalidated();
   status("Cleared from this page. Existing downloads and clipboard contents remain separate.");
 });
 ui.copy.addEventListener("click",async function(){
   if(result===null||!result)return;
   try{
     if(!navigator.clipboard||!navigator.clipboard.writeText)throw Error("Clipboard unavailable");
     await navigator.clipboard.writeText(result);
     status("Prepared text copied. Review it before pasting into another service.");
   }catch(e){status("Clipboard unavailable. Select and copy the output manually.",true);}
 });
 ui.download.addEventListener("click",function(){
   if(result===null||!result)return;
   const blob=new Blob([result],{type:"text/plain;charset=utf-8"});
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download=E.filename(sourceFile,"txt");
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(function(){URL.revokeObjectURL(url);},15000);
   status("Prepared text downloaded locally.");
 });
 ui.sourceCount.textContent="0 / "+E.MAX_CHARS.toLocaleString("en-US");
})();
