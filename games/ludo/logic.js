// Ren spill-logikk for ludo. Ingen DOM, ingen klokke, ingen tilfeldighet:
// terningkastet sendes inn fra game.js.
//
// Posisjon til en brikke, relativt til spillerens eget startfelt:
//   -1        i hjemmefeltet (YARD)
//   0..50     på fellesbanen (0 = startfeltet, 50 = siste felt før innløpet)
//   51..55    i innløpet (egen målsti, kan ikke slås ut)
//   56        i mål (GOAL)

const Ludo = {
  TRACK_LENGTH: 52,
  LAST_TRACK: 50,
  GOAL: 56,
  YARD: -1,
  PIECES: 4,

  // starts: hver spillers startfelt på fellesbanen (0..51).
  create(firstPlayer = 0, starts = [0, 26]) {
    const players = starts.map((start) => ({
      start,
      pieces: Array(Ludo.PIECES).fill(Ludo.YARD),
      throws: 0,
    }));
    return {
      players,
      current: firstPlayer,
      phase: "roll", // "roll" | "move" | "over"
      dice: null,
      rollsLeft: Ludo.rollsFor(players[firstPlayer]),
      legal: [],
      winner: null,
      events: [],
    };
  },

  // Brikker på brettet som ikke er i mål.
  hasPiecesOut(player) {
    return player.pieces.some((p) => p >= 0 && p < Ludo.GOAL);
  },

  // Tre forsøk på å få sekser når ingen brikker er ute, ellers ett kast.
  rollsFor(player) {
    return Ludo.hasPiecesOut(player) ? 1 : 3;
  },

  // Absolutt felt på fellesbanen, eller null (hjemme, innløp, mål).
  square(player, pos) {
    if (pos < 0 || pos > Ludo.LAST_TRACK) return null;
    return (player.start + pos) % Ludo.TRACK_LENGTH;
  },

  // Ny posisjon etter kastet, eller null hvis brikken ikke kan flyttes.
  target(pos, roll) {
    if (pos === Ludo.YARD) return roll === 6 ? 0 : null;
    if (pos === Ludo.GOAL) return null;
    const next = pos + roll;
    return next <= Ludo.GOAL ? next : null; // må treffe mål nøyaktig
  },

  legalMoves(state, roll = state.dice) {
    const player = state.players[state.current];
    const moves = [];
    player.pieces.forEach((pos, i) => {
      if (Ludo.target(pos, roll) !== null) moves.push(i);
    });
    return moves;
  },

  nextTurn(state) {
    const current = (state.current + 1) % state.players.length;
    return {
      ...state,
      current,
      phase: "roll",
      legal: [],
      rollsLeft: Ludo.rollsFor(state.players[current]),
    };
  },

  roll(state, value) {
    if (state.phase !== "roll") return state;
    const me = state.current;
    const players = state.players.map((p, i) =>
      i === me ? { ...p, throws: p.throws + 1 } : p
    );
    const s = {
      ...state,
      players,
      dice: value,
      legal: [],
      events: [{ type: "roll", player: me, value }],
    };

    const legal = Ludo.legalMoves(s, value);
    if (legal.length > 0) return { ...s, phase: "move", legal };

    // Ingen lovlige trekk.
    if (value === 6) return { ...s, rollsLeft: Ludo.rollsFor(players[me]) }; // sekser gir alltid nytt kast
    if (state.rollsLeft > 1) return { ...s, rollsLeft: state.rollsLeft - 1 };
    return Ludo.nextTurn(s);
  },

  move(state, piece) {
    if (state.phase !== "move" || !state.legal.includes(piece)) return state;
    const me = state.current;
    const from = state.players[me].pieces[piece];
    const to = Ludo.target(from, state.dice);
    const events = [{ type: "move", player: me, piece, from, to }];

    const players = state.players.map((p) => ({ ...p, pieces: p.pieces.slice() }));
    players[me].pieces[piece] = to;

    // Slå ut motstandere som står nøyaktig på feltet vi lander på.
    const sq = Ludo.square(players[me], to);
    if (sq !== null) {
      players.forEach((p, pi) => {
        if (pi === me) return;
        p.pieces.forEach((pos, k) => {
          if (Ludo.square(p, pos) === sq) {
            p.pieces[k] = Ludo.YARD;
            events.push({ type: "capture", player: me, victim: pi, piece: k });
          }
        });
      });
    }
    if (to === Ludo.GOAL) events.push({ type: "goal", player: me, piece });

    const s = { ...state, players, events, legal: [] };
    if (players[me].pieces.every((p) => p === Ludo.GOAL)) {
      return { ...s, phase: "over", winner: me };
    }
    if (state.dice === 6) return { ...s, phase: "roll", rollsLeft: 1 };
    return Ludo.nextTurn(s);
  },

  // Kan en motstander av playerIdx lande på absolutt felt sq med neste kast?
  threatened(state, playerIdx, sq) {
    return state.players.some((opp, oi) => {
      if (oi === playerIdx) return false;
      if (sq === opp.start && opp.pieces.includes(Ludo.YARD)) return true;
      return opp.pieces.some((pos) => {
        if (pos < 0 || pos > Ludo.LAST_TRACK) return false;
        for (let d = 1; d <= 6; d++) {
          if (pos + d <= Ludo.LAST_TRACK && Ludo.square(opp, pos + d) === sq) return true;
        }
        return false;
      });
    });
  },

  // Enkel datamaskin-motspiller: poengsetter hvert lovlige trekk.
  chooseMove(state) {
    const me = state.current;
    const player = state.players[me];
    let best = null;
    let bestScore = -Infinity;

    for (const i of state.legal) {
      const from = player.pieces[i];
      const to = Ludo.target(from, state.dice);
      const fromSq = Ludo.square(player, from);
      const toSq = Ludo.square(player, to);
      let score = to / 10; // litt bonus for å komme langt

      if (to === Ludo.GOAL) score += 100;
      if (toSq !== null) {
        const captures = state.players.some(
          (p, pi) => pi !== me && p.pieces.some((pos) => Ludo.square(p, pos) === toSq)
        );
        if (captures) score += 80;
      }
      if (from === Ludo.YARD) score += 60;
      if (from <= Ludo.LAST_TRACK && to > Ludo.LAST_TRACK) score += 40;

      const dangerAfter = toSq !== null && Ludo.threatened(state, me, toSq);
      if (dangerAfter) score -= 35;
      if (fromSq !== null && Ludo.threatened(state, me, fromSq) && !dangerAfter) score += 25;

      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  },
};

if (typeof module !== "undefined") module.exports = Ludo;
