import test from "node:test";
import assert from "node:assert/strict";
import {
 TRACK_LENGTH, SANCTUARIES, newGame, applyAction,
 legalMoves, finishedCount, chooseAiMove, validGame
} from "../engine.mjs";

const roll=(state,n)=>applyAction(state,{type:"ROLL"},()=>n);
const move=(state,piece)=>applyAction(state,{type:"MOVE",piece});

test("initial game is symmetrical, Gold starts and state is valid",()=>{
 const s=newGame();
 assert.deepEqual(s.board,[[-1,-1,-1],[-1,-1,-1]]);
 assert.equal(s.turn,0);
 assert.equal(s.phase,"roll");
 assert.equal(validGame(s),true);
});
test("rolling produces a pending choice without mutating old state",()=>{
 const s=newGame(), r=roll(s,3);
 assert.equal(s.roll,null);
 assert.equal(r.roll,3);
 assert.equal(r.phase,"move");
 assert.deepEqual(legalMoves(r),[0,1,2]);
});
test("invalid roll is rejected",()=>{
 assert.throws(()=>roll(newGame(),5),/Invalid throw/);
});
test("a new lion enters at the correct space",()=>{
 const r=move(roll(newGame(),4),1);
 assert.equal(r.board[0][1],3);
 assert.equal(r.turn,1);
 assert.equal(r.phase,"roll");
 assert.equal(r.moveCount,1);
});
test("cannot move during the other player's phase, choose a nonexistent lion, or stack",()=>{
 const s=roll(newGame(),2);
 assert.equal(move(s,5),s);
 assert.equal(move(newGame(),0).phase,"roll");
 const blocked={...s,board:[[0,1,-1],[-1,-1,-1]],roll:1};
 assert.deepEqual(legalMoves(blocked),[1,2]);
});
test("capture sends rival lion back to the tail",()=>{
 const s={...newGame(),board:[[5,-1,-1],[7,-1,-1]],phase:"move",roll:2};
 const r=move(s,0);
 assert.equal(r.board[0][0],7);
 assert.equal(r.board[1][0],-1);
 assert.match(r.message,/captured/);
});
test("sanctuary protects a rival lion",()=>{
 const dest=SANCTUARIES[0];
 const s={...newGame(),board:[[dest-2,-1,-1],[dest,-1,-1]],phase:"move",roll:2};
 const r=move(s,0);
 assert.equal(r.board[1][0],dest);
});
test("exact finishing requirement blocks overshoot",()=>{
 const s={...newGame(),board:[[TRACK_LENGTH-1,-1,-1],[-1,-1,-1]],phase:"move",roll:3};
 assert.deepEqual(legalMoves(s),[1,2]);
 assert.equal(move(s,0),s);
});
test("finishing 2 lions ends the match",()=>{
 const s={...newGame(),board:[[TRACK_LENGTH,TRACK_LENGTH-2,-1],[-1,-1,-1]],phase:"move",roll:2};
 const r=move(s,1);
 assert.equal(r.winner,0);
 assert.equal(r.phase,"won");
 assert.equal(finishedCount(r,0),2);
 assert.equal(applyAction(r,{type:"ROLL"},()=>1),r);
});
test("turn passes automatically when no legal move is available",()=>{
 const s={...newGame(),board:[[TRACK_LENGTH,TRACK_LENGTH,TRACK_LENGTH-1],[-1,-1,-1]]};
 const r=roll(s,3);
 assert.equal(r.turn,1);
 assert.equal(r.phase,"roll");
 assert.match(r.message,/Turn passed/);
});
test("AI always selects a legal move",()=>{
 const s=roll(newGame(),4);
 assert.ok(legalMoves(s).includes(chooseAiMove(s)));
});
test("untrusted remote states are checked",()=>{
 const s=newGame();
 assert.equal(validGame({...s,message:"x".repeat(500)}),false);
 assert.equal(validGame({...s,board:[[-10,0,0],[0,0,0]]}),false);
 assert.equal(validGame({...s,turn:999}),false);
 assert.equal(validGame({...s,phase:"move",roll:null}),false);
});
