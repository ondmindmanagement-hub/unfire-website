(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.FilePrepEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const MAX_CHARS=200000;
 function ensure(text){
  if(typeof text!=="string")throw Error("Input must be text.");
  if(text.length>MAX_CHARS)throw Error("Maximum input is 200,000 characters.");
  return text;
 }
 function clean(text,options={}){
  ensure(text);
  let out=text.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");
  if(options.trailing)out=out.replace(/[ \t]+$/gm,"");
  if(options.blankLines)out=out.replace(/\n{4,}/g,"\n\n\n");
  if(options.trimOuter)out=out.trim();
  return out;
 }
 function formatJson(text){
  ensure(text);
  try{
   const value=JSON.parse(text);
   return JSON.stringify(value,null,2);
  }catch(e){
   throw Error("Invalid JSON: "+(e&&e.message?e.message:"check the syntax."));
  }
 }
 function validateChunkSize(size,overlap){
  if(!Number.isInteger(size)||size<300||size>12000)throw Error("Chunk size must be 300–12,000 characters.");
  if(!Number.isInteger(overlap)||overlap<0||overlap>1000||overlap>=size)throw Error("Overlap must be 0–1,000 and smaller than the chunk size.");
 }
 function chunk(text,size=4000,overlap=200){
  ensure(text);validateChunkSize(size,overlap);
  if(!text.length)return [];
  const pieces=[];let pos=0;
  while(pos<text.length){
   let end=Math.min(text.length,pos+size);
   if(end<text.length){
    const lastNewline=text.lastIndexOf("\n",end-1);
    const lastSpace=text.lastIndexOf(" ",end-1);
    const preferred=Math.max(lastNewline,lastSpace);
    if(preferred>pos+Math.floor(size*.75)&&preferred<end){
     end=preferred+(text[preferred]==="\n"?1:0);
    }
   }
   if(end<=pos)throw Error("Unable to advance chunk boundary.");
   pieces.push({number:pieces.length+1,start:pos,end:end,text:text.slice(pos,end)});
   if(end===text.length)break;
   const next=Math.max(pos+1,end-overlap);
   pos=next;
   if(pieces.length>1500)throw Error("Too many chunks. Increase chunk size.");
  }
  return pieces;
 }
 function filename(input,extension){
  const safe=String(input||"file-prep").replace(/\.[^.]+$/,"").normalize("NFKC")
    .replace(/[^A-Za-z0-9 _-]/g,"").trim().replace(/\s+/g,"-").slice(0,50)||"file-prep";
  return safe+"-prepared."+(extension==="json"?"json":"txt");
 }
 return {MAX_CHARS,ensure,clean,formatJson,chunk,validateChunkSize,filename};
});
