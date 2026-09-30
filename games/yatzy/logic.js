// Ren spill-logikk for Yatzy. Reglene står i REGLER.md («Vår versjon»).
// Ingen DOM her: tilfeldighet sendes inn som rand() (tall i [0, 1)).
//
// Tilstand:
//   dice:      fem tall 1–6, eller null før første kast i runden
//   held:      fem sannhetsverdier – terninger som blir liggende ved neste kast
//   rollsLeft: kast som gjenstår i runden (3 → 0)
//   scores:    { feltId: poeng }, null for ledige felt
//   round:     1–15
//   status:    "playing" | "over"

const Yatzy = {
  DICE: 5,
  ROLLS: 3,
  BONUS_LIMIT: 63,
  BONUS: 50,

  CATEGORIES: [
    { id: "enere", name: "Enere", upper: 1 },
    { id: "toere", name: "Toere", upper: 2 },
    { id: "treere", name: "Treere", upper: 3 },
    { id: "firere", name: "Firere", upper: 4 },
    { id: "femmere", name: "Femmere", upper: 5 },
    { id: "seksere", name: "Seksere", upper: 6 },
    { id: "par", name: "Ett par" },
    { id: "topar", name: "To par" },
    { id: "trelike", name: "Tre like" },
    { id: "firelike", name: "Fire like" },
    { id: "liten", name: "Liten straight" },
    { id: "stor", name: "Stor straight" },
    { id: "hus", name: "Hus" },
    { id: "sjanse", name: "Sjanse" },
    { id: "yatzy", name: "Yatzy" },
  ],

  create() {
    const scores = {};
    for (const c of Yatzy.CATEGORIES) scores[c.id] = null;
    return { dice: null, held: [false, false, false, false, false], rollsLeft: Yatzy.ROLLS, scores, round: 1, status: "playing" };
  },

  // counts[v] = antall terninger som viser v (indeks 1–6).
  counts(dice) {
    const n = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) n[d]++;
    return n;
  },

  // Poeng terningene gir i et felt. 0 hvis de ikke passer.
  score(dice, id) {
    const n = Yatzy.counts(dice);
    const sum = dice.reduce((a, b) => a + b, 0);
    const cat = Yatzy.CATEGORIES.find((c) => c.id === id);
    if (!cat) throw new Error("Ukjent felt: " + id);
    if (cat.upper) return n[cat.upper] * cat.upper;

    // Høyeste verdi det er minst k av, ellers 0.
    const highest = (k) => {
      for (let v = 6; v >= 1; v--) if (n[v] >= k) return v;
      return 0;
    };
    const straight = (from) => [0, 1, 2, 3, 4].every((i) => n[from + i] === 1);

    switch (id) {
      case "par": return highest(2) * 2;
      case "topar": {
        const pairs = [];
        for (let v = 6; v >= 1; v--) if (n[v] >= 2) pairs.push(v);
        return pairs.length >= 2 ? (pairs[0] + pairs[1]) * 2 : 0;
      }
      case "trelike": return highest(3) * 3;
      case "firelike": return highest(4) * 4;
      case "liten": return straight(1) ? 15 : 0;
      case "stor": return straight(2) ? 20 : 0;
      case "hus": return n.includes(3) && n.includes(2) ? sum : 0;
      case "sjanse": return sum;
      case "yatzy": return n.includes(5) ? 50 : 0;
    }
    return 0;
  },

  canRoll(state) {
    return state.status === "playing" && state.rollsLeft > 0 && !(state.dice && state.held.every(Boolean));
  },

  // Kast alle terninger som ikke holdes.
  roll(state, rand) {
    if (!Yatzy.canRoll(state)) return state;
    const dice = [];
    for (let i = 0; i < Yatzy.DICE; i++) {
      const keep = state.dice && state.held[i];
      dice.push(keep ? state.dice[i] : 1 + Math.floor(rand() * 6));
    }
    return { ...state, dice, rollsLeft: state.rollsLeft - 1 };
  },

  canHold(state) {
    return state.status === "playing" && state.dice !== null && state.rollsLeft > 0;
  },

  toggleHold(state, i) {
    if (!Yatzy.canHold(state) || i < 0 || i >= Yatzy.DICE) return state;
    const held = state.held.slice();
    held[i] = !held[i];
    return { ...state, held };
  },

  canPlace(state, id) {
    return state.status === "playing" && state.dice !== null && state.scores[id] === null;
  },

  // Skriv terningene inn i et ledig felt og gå til neste runde.
  place(state, id) {
    if (!Yatzy.canPlace(state, id)) return state;
    const scores = { ...state.scores, [id]: Yatzy.score(state.dice, id) };
    const over = Yatzy.CATEGORIES.every((c) => scores[c.id] !== null);
    return {
      dice: null,
      held: [false, false, false, false, false],
      rollsLeft: over ? 0 : Yatzy.ROLLS,
      scores,
      round: over ? state.round : state.round + 1,
      status: over ? "over" : "playing",
    };
  },

  // Hva hvert ledige felt ville gitt med terningene som ligger. Tomt før første kast.
  potential(state) {
    const out = {};
    if (!state.dice) return out;
    for (const c of Yatzy.CATEGORIES) if (state.scores[c.id] === null) out[c.id] = Yatzy.score(state.dice, c.id);
    return out;
  },

  upperSum(state) {
    return Yatzy.CATEGORIES.reduce((a, c) => a + (c.upper ? state.scores[c.id] || 0 : 0), 0);
  },

  bonus(state) {
    return Yatzy.upperSum(state) >= Yatzy.BONUS_LIMIT ? Yatzy.BONUS : 0;
  },

  total(state) {
    return Yatzy.CATEGORIES.reduce((a, c) => a + (state.scores[c.id] || 0), 0) + Yatzy.bonus(state);
  },
};

if (typeof module !== "undefined") module.exports = Yatzy;
