/**
 * MEHEN · The Eternal Serpent
 * Modern Unfire rules. The historical rules of Mehen are unknown.
 * Deterministic, immutable game engine; no DOM, network, or persistence.
 */
export const TRACK_LENGTH = 60;
export const PIECES_PER_PLAYER = 3;
export const SANCTUARIES = Object.freeze([8, 19, 30, 41, 52]);
export const isSafe = (position) => SANCTUARIES.includes(position);

export function newGame() {
  return {
    version: 1,
    board: [Array(PIECES_PER_PLAYER).fill(-1), Array(PIECES_PER_PLAYER).fill(-1)],
    turn: 0,
    roll: null,
    phase: "roll",
    winner: null,
    moveCount: 0,
    message: "The serpent awakens. Gold begins.",
  };
}

export function legalMoves(game) {
  if (game.phase !== "move" || !Number.isInteger(game.roll)) return [];
  const own = game.board[game.turn];
  return own.flatMap((position, i) =>
    position < TRACK_LENGTH &&
    position + game.roll <= TRACK_LENGTH &&
    !own.some((other, j) => j !== i && other === position + game.roll && other < TRACK_LENGTH)
      ? [i] : []
  );
}

export function finishedCount(game, side) {
  return game.board[side].filter((x) => x === TRACK_LENGTH).length;
}

const label = (side) => side === 0 ? "Gold" : "Lapis";
const nextPlayer = (game, message) => ({
  ...game, turn: 1 - game.turn, roll: null, phase: "roll", message,
});

export function applyAction(game, action, randomInt = defaultRoll) {
  if (!game || game.version !== 1 || game.phase === "won") return game;
  if (action?.type === "ROLL" && game.phase === "roll") {
    const rolled = randomInt();
    if (!Number.isInteger(rolled) || rolled < 1 || rolled > 4) throw Error("Invalid throw");
    const pending = { ...game, roll: rolled, phase: "move", message: `${label(game.turn)} cast ${rolled}. Choose a lion.` };
    if (legalMoves(pending).length === 0)
      return nextPlayer(pending, `${label(game.turn)} cast ${rolled} but has no legal move. Turn passed.`);
    return pending;
  }
  if (action?.type === "MOVE" && game.phase === "move") {
    const piece = action.piece;
    if (!Number.isInteger(piece) || !legalMoves(game).includes(piece)) return game;
    const updated = game.board.map((tokens) => tokens.slice());
    const side = game.turn;
    const from = updated[side][piece];
    const to = from + game.roll;
    updated[side][piece] = to;
    let captures = 0;
    if (to < TRACK_LENGTH && !isSafe(to)) {
      for (let i = 0; i < PIECES_PER_PLAYER; i++) {
        if (updated[1 - side][i] === to) {
          updated[1 - side][i] = -1;
          captures++;
        }
      }
    }
    const completed = updated[side].filter((p) => p === TRACK_LENGTH).length;
    const base = { ...game, board: updated, moveCount: game.moveCount + 1 };
    if (completed >= 2)
      return { ...base, phase: "won", winner: side, roll: null, message: `${label(side)} reached the heart of Mehen and wins!` };
    const event = to === TRACK_LENGTH
      ? `${label(side)} guided a lion to the heart.`
      : captures ? `${label(side)} captured ${captures} rival lion${captures > 1 ? "s" : ""}.`
      : `${label(side)} advanced a lion to space ${to + 1}.`;
    return nextPlayer(base, event);
  }
  return game;
}

/** Cryptographically sampled 1–4 die; reject modulo bias. */
export function defaultRoll() {
  if (typeof crypto === "undefined" || !crypto.getRandomValues)
    return Math.floor(Math.random() * 4) + 1;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 4) + 1;
}

export function chooseAiMove(game) {
  const moves = legalMoves(game);
  if (!moves.length) return null;
  const side = game.turn, opponent = 1 - side;
  return moves.map((piece) => {
    const current = game.board[side][piece];
    const destination = current + game.roll;
    const capture = destination < TRACK_LENGTH && !isSafe(destination) &&
      game.board[opponent].includes(destination);
    const completion = destination === TRACK_LENGTH;
    const progress = Math.max(0, destination);
    const exposed = !isSafe(destination) && destination < TRACK_LENGTH;
    const score = (completion ? 140 : 0) + (capture ? 82 : 0) +
      progress * 0.25 + (isSafe(destination) ? 8 : 0) -
      (exposed ? 2 : 0) + (current === -1 ? 4 : 0);
    return { piece, score };
  }).sort((a, b) => b.score - a.score || a.piece - b.piece)[0].piece;
}

/** Reject unsolicited/malformed remote state before it reaches the UI. */
export function validGame(game) {
  return !!game && game.version === 1 &&
    Array.isArray(game.board) && game.board.length === 2 &&
    game.board.every((p) => Array.isArray(p) && p.length === 3 &&
      p.every((n) => Number.isInteger(n) && n >= -1 && n <= TRACK_LENGTH)) &&
    [0,1].includes(game.turn) &&
    ["roll","move","won"].includes(game.phase) &&
    (game.roll === null || (Number.isInteger(game.roll) && game.roll >= 1 && game.roll <= 4)) &&
    (game.winner === null || [0,1].includes(game.winner)) &&
    Number.isInteger(game.moveCount) && game.moveCount >= 0 && game.moveCount < 100000 &&
    typeof game.message === "string" && game.message.length <= 220 &&
    (game.phase !== "move" || game.roll !== null) &&
    (game.phase !== "won" || game.winner !== null);
}
