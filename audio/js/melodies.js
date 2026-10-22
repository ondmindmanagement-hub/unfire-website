/* Melodías de dominio público (composiciones anteriores a 1926) transcritas para los demos.
   Formato: { step: duración de un paso en segundos, len: pasos del bucle, start: paso inicial,
              notes: [[paso, midi, duraciónEnPasos, velocidad]] } */
const SONGS = (() => {
  const N = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const m = (s) => { const r = /^([A-G](?:#|b)?)(-?\d)$/.exec(s); return (parseInt(r[2], 10) + 1) * 12 + N[r[1]]; };
  // Secuencia "nota:pasos nota:pasos ..." ; "r:n" = silencio
  const seq = (str, start = 0, vel = 0.8) => {
    const out = []; let t = start;
    str.trim().split(/\s+/).forEach((tok) => {
      const [n, d] = tok.split(':'); const len = parseFloat(d || '1');
      if (n !== 'r') out.push([t, m(n), len, vel]);
      t += len;
    });
    return out;
  };
  const at = (pairs, vel = 0.6, len = 1) => pairs.trim().split(/\s+/).map((tok) => { const [s, n, l] = tok.split('@'); return [parseFloat(s), m(n), parseFloat(l || len), vel]; });

  return {
    furElise: {
      title: 'Für Elise', author: 'L. van Beethoven (1810)', step: 0.125, len: 48, start: 46,
      notes: [
        ...seq('E5 D#5 E5 B4 D5 C5', 0, 0.75),
        ...at('6@A4@2 9@C4 10@E4 11@A4 12@B4@2 15@E4 16@G#4 17@B4 18@C5@2 21@E4 22@E5 23@D#5', 0.7),
        ...seq('E5 D#5 E5 B4 D5 C5', 24, 0.75),
        ...at('30@A4@2 33@C4 34@E4 35@A4 36@B4@2 39@E4 40@C5 41@B4 42@A4@4 46@E5 47@D#5', 0.7),
        ...at('6@A2 7@E3 8@A3 12@E2 13@E3 14@G#3 18@A2 19@E3 20@A3 30@A2 31@E3 32@A3 36@E2 37@E3 38@G#3 42@A2 43@E3 44@A3', 0.45),
      ],
    },
    amazingGrace: {
      title: 'Amazing Grace', author: 'Tradicional (1779)', step: 0.3, len: 48, start: 0,
      notes: seq('D4:2 G4:4 B4:1 G4:1 B4:4 A4:2 G4:4 E4:2 D4:4 D4:2 G4:4 B4:1 G4:1 B4:4 A4:2 D5:10', 0, 0.8),
    },
    odeToJoy: {
      title: 'Oda a la alegría', author: 'L. van Beethoven (1824)', step: 0.26, len: 64, start: 0,
      notes: seq('E4:2 E4:2 F4:2 G4:2 G4:2 F4:2 E4:2 D4:2 C4:2 C4:2 D4:2 E4:2 E4:3 D4:1 D4:4 ' +
                 'E4:2 E4:2 F4:2 G4:2 G4:2 F4:2 E4:2 D4:2 C4:2 C4:2 D4:2 E4:2 D4:3 C4:1 C4:4'),
    },
    mountainKing: {
      title: 'En la gruta del rey de la montaña', author: 'E. Grieg (1875)', step: 0.16, len: 32, start: 0,
      notes: seq('B3 C#4 D4 E4 F#4 D4 F#4:2 F4 C#4 F4:2 E4 C4 E4:2 B3 C#4 D4 E4 F#4 D4 F#4 B4 A4 F#4 D4 F#4 A4:4', 0, 0.8),
    },
    greensleeves: {
      title: 'Greensleeves', author: 'Tradicional (s. XVI)', step: 0.2, len: 48, start: 0,
      notes: seq('A4:2 C5:4 D5:2 E5:3 F5:1 E5:2 D5:4 B4:2 G4:3 A4:1 B4:2 C5:4 A4:2 A4:3 G#4:1 A4:2 B4:4 G#4:2 E4:4', 0, 0.8),
    },
    morningMood: {
      title: 'La mañana', author: 'E. Grieg (1875)', step: 0.22, len: 32, start: 0,
      notes: seq('G5 E5 D5 C5 D5 E5 G5 E5 D5 C5 D5 E5 D5 E5 G5 E5 G5 A5 E5 A5 G5 E5 D5 C5:7', 0, 0.75),
    },
    entertainer: {
      title: 'The Entertainer', author: 'S. Joplin (1902)', step: 0.14, len: 32, start: 0,
      notes: seq('D5 D#5 E5 C6:2 E5 C6:2 E5 C6:6 C6 D6 D#6 E6 C6 D6 E6:2 B5 D6:2 C6:4 r:2', 0, 0.8),
    },
    nachtmusik: {
      title: 'Pequeña serenata nocturna', author: 'W. A. Mozart (1787)', step: 0.17, len: 32, start: 0,
      notes: seq('G4:2 r:1 D4:1 G4:2 r:1 D4:1 G4 D4 G4 B4 D5:4 C5:2 r:1 A4:1 C5:2 r:1 A4:1 C5 A4 F#4 A4 D4:4', 0, 0.8),
    },
    turkishMarch: {
      title: 'Marcha turca', author: 'W. A. Mozart (1783)', step: 0.12, len: 32, start: 0,
      notes: seq('B4 A4 G#4 A4 C5:4 D5 C5 B4 C5 E5:4 F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6:4', 0, 0.8),
    },
    toccata: {
      title: 'Tocata y fuga en re menor', author: 'J. S. Bach (c. 1704)', step: 0.11, len: 84, start: 0,
      notes: seq('A5 G5 A5:6 G5 F5 E5 D5 C#5:4 D5:8 r:4 A4 G4 A4:6 E4:2 F4:2 C#4:4 D4:8 r:4 A3 G3 A3:6 G3 F3 E3 D3 C#3:4 D3:8', 0, 0.85),
    },
    gymnopedie: {
      title: 'Gymnopédie n.º 1', author: 'E. Satie (1888)', step: 0.42, len: 48, start: 0,
      notes: [
        ...at('0@G2@3 1@B3@2 1@D4@2 1@F#4@2 3@D2@3 4@A3@2 4@C#4@2 4@F#4@2 6@G2@3 7@B3@2 7@D4@2 7@F#4@2 9@D2@3 10@A3@2 10@C#4@2 10@F#4@2 ' +
              '12@G2@3 13@B3@2 13@D4@2 13@F#4@2 15@D2@3 16@A3@2 16@C#4@2 16@F#4@2 18@G2@3 19@B3@2 19@D4@2 19@F#4@2 21@D2@3 22@A3@2 22@C#4@2 22@F#4@2 ' +
              '24@G2@3 25@B3@2 25@D4@2 25@F#4@2 27@D2@3 28@A3@2 28@C#4@2 28@F#4@2 30@G2@3 31@B3@2 31@D4@2 31@F#4@2 33@D2@3 34@A3@2 34@C#4@2 34@F#4@2 ' +
              '36@G2@3 37@B3@2 37@D4@2 37@F#4@2 39@D2@3 40@A3@2 40@C#4@2 40@F#4@2 42@G2@3 43@B3@2 43@D4@2 43@F#4@2 45@D2@3 46@A3@2 46@C#4@2 46@F#4@2', 0.4),
        ...seq('r:13 F#5 A5 G5 F#5 C#5 B4 C#5 D5 A4:3 F#4:3 F#4:3 F#4:3', 0, 0.75),
      ],
    },
    preludeC: {
      title: 'Preludio en do mayor', author: 'J. S. Bach (1722)', step: 0.14, len: 128, start: 0,
      notes: (() => {
        const bars = [['C4', 'E4', 'G4', 'C5', 'E5'], ['C4', 'D4', 'A4', 'D5', 'F5'], ['B3', 'D4', 'G4', 'D5', 'F5'], ['C4', 'E4', 'G4', 'C5', 'E5'],
                      ['C4', 'E4', 'A4', 'E5', 'A5'], ['C4', 'D4', 'F#4', 'A4', 'D5'], ['B3', 'D4', 'G4', 'D5', 'G5'], ['B3', 'C4', 'E4', 'G4', 'C5']];
        const out = [];
        bars.forEach((b, i) => {
          for (let h = 0; h < 2; h++) {
            const s = i * 16 + h * 8;
            out.push([s, m(b[0]), 8, 0.55], [s + 1, m(b[1]), 7, 0.55]);
            [2, 3, 4, 2, 3, 4].forEach((k, j) => out.push([s + 2 + j, m(b[k]), 1, 0.6]));
          }
        });
        return out;
      })(),
    },
    canon: {
      title: 'Canon en re', author: 'J. Pachelbel (c. 1680)', step: 0.55, len: 16, start: 0,
      notes: [
        ...at('0@D3@2 2@A2@2 4@B2@2 6@F#2@2 8@G2@2 10@D2@2 12@G2@2 14@A2@2', 0.55),
        ...seq('F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2', 0, 0.7),
      ],
    },
    moonlight: {
      title: 'Claro de luna (1.er mov.)', author: 'L. van Beethoven (1801)', step: 0.19, len: 48, start: 0,
      notes: (() => {
        const ch = [['C#3', 'G#3', 'C#4', 'E4'], ['C#3', 'G#3', 'C#4', 'E4'], ['B2', 'G#3', 'C#4', 'E4'], ['B2', 'G#3', 'C#4', 'E4'],
                    ['A2', 'A3', 'C#4', 'E4'], ['A2', 'A3', 'C#4', 'E4'], ['F#2', 'A3', 'D4', 'F#4'], ['G#2', 'G#3', 'C4', 'F#4']];
        const out = [];
        ch.forEach((c, i) => {
          const s = i * 6; out.push([s, m(c[0]), 6, 0.5]);
          for (let k = 0; k < 6; k++) out.push([s + k, m(c[1 + (k % 3)]), 1, 0.45]);
        });
        return out;
      })(),
    },
    twinkle: {
      title: 'Ah, vous dirai-je, maman', author: 'Tradicional (1761)', step: 0.25, len: 32, start: 0,
      notes: seq('C5 C5 G5 G5 A5 A5 G5:2 F5 F5 E5 E5 D5 D5 C5:2 G5 G5 F5 F5 E5 E5 D5:2 G5 G5 F5 F5 E5 E5 D5:2', 0, 0.8),
    },
  };
})();
