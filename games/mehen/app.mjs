import {
  TRACK_LENGTH, SANCTUARIES, newGame, applyAction,
  legalMoves, finishedCount, chooseAiMove, validGame
} from "./engine.mjs";

const $ = (id) => document.getElementById(id);
const svg = $("board");
const NS = "http://www.w3.org/2000/svg";
const center = 400;
let game = newGame();
let mode = "ai";
let peer = null, connection = null, hosting = false, mySide = null, room = "";
let aiTimer = null, revision = 0;
const positions = [];
const players = [{name:"Gold", color:"#e7c785"}, {name:"Lapis", color:"#79c6ce"}];

function node(tag, attributes = {}, parent = svg, text = null) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attributes).forEach(([key, value]) => e.setAttribute(key, String(value)));
  if (text !== null) e.textContent = String(text);
  parent.append(e);
  return e;
}

function makeBoard() {
  svg.replaceChildren();
  const defs = node("defs");
  const stone = node("radialGradient", {id:"mehenStone",cx:"45%",cy:"36%",r:"72%"}, defs);
  node("stop",{offset:"0%", "stop-color":"#a99670"}, stone);
  node("stop",{offset:"65%", "stop-color":"#745f45"}, stone);
  node("stop",{offset:"100%", "stop-color":"#302a23"}, stone);
  const gold = node("radialGradient",{id:"mehenGold",cx:"31%",cy:"27%",r:"79%"},defs);
  node("stop",{offset:"0%","stop-color":"#ffedb8"},gold);
  node("stop",{offset:"55%","stop-color":"#d1a956"},gold);
  node("stop",{offset:"100%","stop-color":"#79532f"},gold);
  const blue = node("radialGradient",{id:"mehenBlue",cx:"32%",cy:"27%",r:"79%"},defs);
  node("stop",{offset:"0%","stop-color":"#a3f7ea"},blue);
  node("stop",{offset:"55%","stop-color":"#398d9c"},blue);
  node("stop",{offset:"100%","stop-color":"#1e5267"},blue);
  node("circle",{cx:center,cy:center,r:391,fill:"#091a22",stroke:"#766847","stroke-width":1.2});
  node("circle",{cx:center,cy:center,r:371,fill:"none",stroke:"#b4a174","stroke-opacity":".24","stroke-width":1});
  node("circle",{cx:center,cy:center,r:350,fill:"none",stroke:"#b4a174","stroke-opacity":".25","stroke-width":1,"stroke-dasharray":"2 15"});
  for (let k=0;k<72;k++) {
    const angle=k*2*Math.PI/72;
    const x1=center+375*Math.cos(angle),y1=center+375*Math.sin(angle);
    const x2=center+(k%6===0?387:381)*Math.cos(angle);
    const y2=center+(k%6===0?387:381)*Math.sin(angle);
    node("line",{x1,y1,x2,y2,stroke:"#9d8964","stroke-width":k%6===0?2.5:1,"stroke-opacity":".7"});
  }
  // The path is an original rendering, not a scan or copy of a museum artefact.
  const turn=3.68*2*Math.PI, initial=1.02*Math.PI;
  for (let i=0;i<TRACK_LENGTH;i++) {
    const t=i/(TRACK_LENGTH-1), a=initial+turn*t, r=323-274*t;
    positions.push({x:center+r*Math.cos(a),y:center+r*Math.sin(a)});
  }
  const pathPoints=[];
  for(let i=0;i<=900;i++) {
    const t=i/900,a=initial+turn*t,r=323-274*t;
    pathPoints.push(`${i?"L":"M"}${(center+r*Math.cos(a)).toFixed(2)},${(center+r*Math.sin(a)).toFixed(2)}`);
  }
  const d=pathPoints.join(" ");
  node("path",{d,fill:"none",stroke:"#151e1d","stroke-width":52,"stroke-linecap":"round","stroke-linejoin":"round"});
  node("path",{d,fill:"none",stroke:"#b09c73","stroke-width":46,"stroke-linecap":"round","stroke-linejoin":"round"});
  node("path",{d,fill:"none",stroke:"url(#mehenStone)","stroke-width":39,"stroke-linecap":"round","stroke-linejoin":"round"});
  node("path",{d,fill:"none",stroke:"#cdbb8e","stroke-opacity":".52","stroke-width":1.5,"stroke-linecap":"round","stroke-dasharray":"2 7"});
  positions.forEach(({x,y},i) => {
    const safe = SANCTUARIES.includes(i);
    if(safe) {
      node("circle",{cx:x,cy:y,r:20,fill:"#c2aa73","fill-opacity":".33"});
      node("path",{d:`M${x},${y-13} L${x+13},${y} L${x},${y+13} L${x-13},${y}Z`,stroke:"#fff0b8","stroke-width":2,fill:"#173e45"});
    } else {
      node("circle",{cx:x,cy:y,r:10.5,fill:"#31464a","fill-opacity":".9",stroke:"#dbc598","stroke-opacity":".5","stroke-width":1.5});
      node("circle",{cx:x,cy:y,r:2,fill:"#dfc899","fill-opacity":".8"});
    }
  });
  node("circle",{cx:center,cy:center,r:34,fill:"#f2dba7","fill-opacity":".11"});
  node("circle",{cx:center,cy:center,r:26,fill:"#e6c17d",stroke:"#ffecb8","stroke-width":2});
  node("text",{x:center,y:center+9,"text-anchor":"middle",fill:"#364751","font-size":26},svg,"✹");
  const head=positions.at(-1),tail=positions[0];
  node("ellipse",{cx:head.x,cy:head.y,rx:30,ry:23,fill:"#ab9874",stroke:"#332a1d","stroke-width":4});
  node("circle",{cx:head.x-12,cy:head.y-5,r:3.5,fill:"#14313c"});
  node("circle",{cx:head.x+12,cy:head.y-5,r:3.5,fill:"#14313c"});
  node("path",{d:`M${head.x},${head.y+12}q0,15 -9,20m9,-20q0,15 9,20`,stroke:"#d28b70","stroke-width":3,fill:"none"});
  node("circle",{cx:tail.x,cy:tail.y,r:8,fill:"#d2b67a",stroke:"#1d3337","stroke-width":2});
  // Pieces remain in their own SVG layer for stable focus and hit targets.
  node("g",{id:"tokensLayer"});
}

function pieceXY(side,index,progress) {
  if (progress===-1) {
    return {x:side===0?130+index*49:559+index*49,y:737};
  }
  if (progress===TRACK_LENGTH) return {x:side===0?350+index*19:410+index*19,y:400+(side===0?31:-31)};
  const point=positions[progress];
  const peers=game.board[side].filter((p)=>p===progress).length;
  return {x:point.x,y:point.y+(peers>1?index*7:0)};
}

function eligible(side,index) {
  return game.turn===side && legalMoves(game).includes(index) && isMyTurn();
}
function renderTokens() {
  const layer=$("tokensLayer");
  layer.replaceChildren();
  for(let side=0;side<2;side++) for(let i=0;i<3;i++) {
    const progress=game.board[side][i],p=pieceXY(side,i,progress);
    const available=eligible(side,i);
    const g=node("g",{class:`piece${available?" available":""}`,transform:`translate(${p.x} ${p.y})`,role:"button",tabindex:available?"0":"-1","aria-label":`${players[side].name} lion ${i+1}, ${progress<0?"at tail":progress===TRACK_LENGTH?"at heart":`space ${progress+1}`}${available?", choose this lion":""}`,"aria-disabled":available?"false":"true","data-side":side,"data-index":i},layer);
    node("circle",{r:21,fill:"#07161b",stroke:players[side].color,"stroke-width":available?3:1.7},g);
    node("circle",{r:17,class:"token-core",fill:side===0?"url(#mehenGold)":"url(#mehenBlue)",stroke:players[side].color,"stroke-width":2},g);
    node("text",{y:7,"text-anchor":"middle",fill:"#182d32","font-family":"Georgia,serif","font-size":22},g,side===0?"✹":"✧");
    if(available){
      g.addEventListener("click",()=>move(i));
      g.addEventListener("keydown",(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();move(i);}});
    }
  }
}
function isMyTurn() {
  if(mode==="ai") return game.turn===0;
  if(mode==="local") return true;
  return connection?.open===true && mySide===game.turn;
}
function updateUI() {
  renderTokens();
  $("progress0").textContent=`${finishedCount(game,0)} / 2 AT THE HEART`;
  $("progress1").textContent=`${finishedCount(game,1)} / 2 AT THE HEART`;
  $("turn0").classList.toggle("active",game.turn===0&&game.phase!=="won");
  $("turn1").classList.toggle("active",game.turn===1&&game.phase!=="won");
  $("sessionLabel").textContent=mode==="ai"?"SOLO · AI":mode==="local"?"TWO PLAYERS · LOCAL":connection?.open?"ONLINE · CONNECTED":"ONLINE · WAITING";
  $("dieValue").textContent=game.phase==="won"?"VICTORY":game.roll===null?"READY":String(game.roll);
  $("dieFace").textContent=game.roll===null?"✦":["","Ⅰ","Ⅱ","Ⅲ","Ⅳ"][game.roll];
  $("status").textContent=game.message+(mode==="online"&&!connection?.open?" Waiting for a second player.":mode==="ai"&&game.turn===1&&game.phase!=="won"?" The AI is thinking.":"");
  $("rollBtn").disabled=game.phase!=="roll"||!isMyTurn();
  $("rollBtn").innerHTML=game.phase==="won"?"MATCH FINISHED <span>✦</span>":game.phase==="move"?"SELECT A LION <span>↗</span>":"CAST THE STICKS <span>↗</span>";
  $("resetBtn").disabled=mode==="online"&&(!hosting||!connection?.open);
  for(const [id,option] of [["aiBtn","ai"],["localBtn","local"],["onlineBtn","online"]]) {
    $(id).classList.toggle("active",mode===option);
    $(id).setAttribute("aria-pressed",String(mode===option));
  }
  $("onlinePanel").hidden=mode!=="online";
}

function cancelAi(){revision++;if(aiTimer!==null)clearTimeout(aiTimer);aiTimer=null;}
function reset(){cancelAi();game=newGame();broadcast();updateUI();scheduleAi();}
function commitAction(action){
  const updated=applyAction(game,action);
  if(updated===game)return;
  game=updated;
  broadcast();
  updateUI();
  scheduleAi();
}
function request(action){
  if(!isMyTurn())return;
  if(mode==="online"&&!hosting) {
    if(connection?.open)connection.send({type:"action",action:action.type,piece:action.piece});
  } else commitAction(action);
}
function move(index){if(game.phase==="move")request({type:"MOVE",piece:index});}
function scheduleAi(){
  cancelAi();
  if(mode!=="ai"||game.turn!==1||game.phase==="won")return;
  const tick=revision;
  aiTimer=setTimeout(()=>{
    if(tick!==revision||mode!=="ai")return;
    if(game.phase==="roll")commitAction({type:"ROLL"});
    else if(game.phase==="move"){
      const piece=chooseAiMove(game);
      if(piece!==null)commitAction({type:"MOVE",piece});
    }
  },700);
}

function netStatus(message){$("netStatus").textContent=message;}
function codeFromUrl() {
  const value=new URLSearchParams(location.search).get("room")||"";
  return /^[A-HJ-NP-Z2-9]{10}$/.test(value)?value:"";
}
function generateCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",bytes=new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,x=>chars[x%chars.length]).join("");
}
function peerId(code){return `unfire-mehen-${code.toLowerCase()}`;}
function cleanup(){
  cancelAi();
  try{connection?.close();}catch{}
  try{peer?.destroy();}catch{}
  connection=null;peer=null;hosting=false;mySide=null;room="";
  $("inviteArea").hidden=true;
  $("disconnectBtn").hidden=true;
}
function changeMode(next){
  if(next===mode)return;
  cleanup();
  mode=next;
  netStatus("Not connected.");
  game=newGame();
  updateUI();
  scheduleAi();
}
function broadcast(){
  if(mode==="online"&&hosting&&connection?.open)
    connection.send({type:"state",game});
}
function bindConnection(conn,host){
  connection=conn;
  conn.on("open",()=>{
    $("disconnectBtn").hidden=false;
    netStatus(host?"Friend connected. Gold's turn.":"Connected! You play Lapis. Waiting for host.");
    if(host)broadcast();
    updateUI();
  });
  conn.on("data",(data)=>{
    if(!data||typeof data!=="object")return;
    if(host&&data.type==="action"&&game.turn===1&&connection===conn) {
      if(data.action==="ROLL")commitAction({type:"ROLL"});
      if(data.action==="MOVE"&&Number.isInteger(data.piece))commitAction({type:"MOVE",piece:data.piece});
    }
    if(!host&&data.type==="state"&&validGame(data.game)) {
      game=data.game;
      updateUI();
    }
  });
  conn.on("close",()=>{
    if(connection===conn)connection=null;
    netStatus(host?"Guest disconnected. Room is still open.":"Disconnected from host. Join again to retry.");
    updateUI();
  });
  conn.on("error",()=>netStatus("Connection failed. Try leaving and joining again."));
}
function onPeerError(error){
  const message=error?.type==="unavailable-id"?"That room code is already in use.":"Could not reach the multiplayer service.";
  netStatus(message);
  updateUI();
}
function hostRoom(){
  if(mode!=="online")changeMode("online");
  cleanup();
  if(typeof window.Peer!=="function"){netStatus("Online library unavailable. Check your connection.");return;}
  hosting=true;mySide=0;room=generateCode();
  game=newGame();updateUI();
  peer=new window.Peer(peerId(room));
  peer.on("open",()=>{
    $("roomCode").textContent=room;
    $("inviteArea").hidden=false;
    $("disconnectBtn").hidden=false;
    netStatus("Room ready. Share your code or invite link with a friend.");
  });
  peer.on("connection",(incoming)=>{
    if(connection?.open){incoming.close();return;}
    bindConnection(incoming,true);
  });
  peer.on("error",onPeerError);
  netStatus("Creating a room…");
}
function joinRoom(){
  if(mode!=="online")changeMode("online");
  const code=$("roomInput").value.trim().toUpperCase().replace(/\s/g,"");
  if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code)){netStatus("Enter a valid 10-character room code.");return;}
  cleanup();
  if(typeof window.Peer!=="function"){netStatus("Online library unavailable. Check your connection.");return;}
  hosting=false;mySide=1;room=code;game=newGame();updateUI();
  peer=new window.Peer();
  peer.on("open",()=>bindConnection(peer.connect(peerId(code),{reliable:true}),false));
  peer.on("error",onPeerError);
  netStatus("Connecting to room…");
}
function copyInvite(){
  // A file:// or localhost URL is not usable by a friend on another device.
  const publicPage=(location.protocol==="https:" || location.protocol==="http:") &&
    !["localhost","127.0.0.1","::1"].includes(location.hostname);
  const url=new URL(location.href);
  url.searchParams.set("room",room);
  const invitation=publicPage?url.toString():room;
  const success=publicPage?"Invitation link copied.":"Room code copied. Both players must open the game.";
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(invitation).then(()=>netStatus(success))
      .catch(()=>netStatus(`Share this room code: ${room}`));
  }else netStatus(`Share this room code: ${room}`);
}
function disconnect(){
  cleanup();
  game=newGame();netStatus("Left the online match.");updateUI();
}

$("aiBtn").addEventListener("click",()=>changeMode("ai"));
$("localBtn").addEventListener("click",()=>changeMode("local"));
$("onlineBtn").addEventListener("click",()=>changeMode("online"));
$("rollBtn").addEventListener("click",()=>request({type:"ROLL"}));
$("resetBtn").addEventListener("click",reset);
$("hostBtn").addEventListener("click",hostRoom);
$("joinBtn").addEventListener("click",joinRoom);
$("roomInput").addEventListener("keydown",e=>{if(e.key==="Enter")joinRoom();});
$("copyBtn").addEventListener("click",copyInvite);
$("disconnectBtn").addEventListener("click",disconnect);
$("howBtn").addEventListener("click",()=>$("rulesDialog").showModal());
$("closeRules").addEventListener("click",()=>$("rulesDialog").close());
$("rulesPlay").addEventListener("click",()=>$("rulesDialog").close());
$("rulesDialog").addEventListener("click",(e)=>{if(e.target===$("rulesDialog"))$("rulesDialog").close();});
window.addEventListener("pagehide",cleanup);
makeBoard();
const queryRoom=codeFromUrl();
if(queryRoom){
  $("roomInput").value=queryRoom;
  mode="online";
  netStatus("Invite loaded. Choose JOIN when ready.");
}
updateUI();

if ("serviceWorker" in navigator && (location.protocol==="https:" || ["localhost","127.0.0.1"].includes(location.hostname))) { window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}),{once:true}); }
