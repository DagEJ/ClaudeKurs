// Ren logikk for Poengblokk. Ingen DOM og ingen lagring. Reglene står i REGLER.md («Vår versjon»).
//
// Tilstand:
//   players:   navn
//   mode:      "hoyest" | "lavest" | "nedtelling"
//   start:     tallet det telles ned fra (bare nedtelling)
//   target:    poenggrense som avslutter spillet, eller null
//   maxRounds: antall runder, eller null
//   rounds:    førte runder, [runde][spiller] = heltall
//   draft:     runden som føres nå, [spiller] = heltall eller null (tomt felt)
//   ended:     avsluttet for hånd
const Scorepad = (function () {
  const MAX_PLAYERS = 8;
  const MAX_NAME = 20;
  const MAX_VALUE = 99999;
  const MODES = ["hoyest", "lavest", "nedtelling"];
  const TEMPLATES = [
    { id: "fritt", name: "Fritt", mode: "hoyest", start: null, target: null, maxRounds: null },
    { id: "kort500", name: "Kortspill til 500", mode: "hoyest", start: null, target: 500, maxRounds: null },
    { id: "lavest100", name: "Lavest vinner, til 100", mode: "lavest", start: null, target: 100, maxRounds: null },
    { id: "minigolf", name: "Minigolf, 18 hull", mode: "lavest", start: null, target: null, maxRounds: 18 },
    { id: "dart501", name: "Dart 501", mode: "nedtelling", start: 501, target: null, maxRounds: null },
  ];

  // Positivt heltall, ellers null. Tar også tekst fra et skjemafelt.
  function posInt(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_VALUE) : null;
  }

  // Poeng fra et skjemafelt: heltall, eller null for tomt/ugyldig. Nedtelling tar ikke negative tall.
  function toScore(v, mode) {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    let n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    n = Math.max(-MAX_VALUE, Math.min(MAX_VALUE, Math.round(n)));
    if (mode === "nedtelling") n = Math.max(0, n);
    return n === 0 ? 0 : n; // unngå -0
  }

  function create(config) {
    const c = config || {};
    const list = Array.isArray(c.players) && c.players.length ? c.players.slice(0, MAX_PLAYERS) : [""];
    const players = list.map((name, i) => String(name == null ? "" : name).trim().slice(0, MAX_NAME) || "Spiller " + (i + 1));
    const mode = MODES.includes(c.mode) ? c.mode : "hoyest";
    const counting = mode === "nedtelling";
    return {
      players,
      mode,
      start: counting ? posInt(c.start) || 501 : null,
      target: counting ? null : posInt(c.target),
      maxRounds: counting ? null : posInt(c.maxRounds),
      rounds: [],
      draft: players.map(() => null),
      ended: false,
    };
  }

  // Innstillingene til et spill, for «Ny omgang».
  function config(state) {
    const { players, mode, start, target, maxRounds } = state;
    return { players: players.slice(), mode, start, target, maxRounds };
  }

  // Stillingen: sum (eller det som er igjen) per spiller, hvilke ruter som sprakk,
  // og hvem som først kom til 0 i nedtelling.
  function standing(state) {
    const n = state.players.length;
    const bust = state.rounds.map(() => new Array(n).fill(false));
    if (state.mode !== "nedtelling") {
      const totals = state.players.map((_, p) => state.rounds.reduce((sum, round) => sum + round[p], 0));
      return { totals, bust, zero: null };
    }
    const totals = new Array(n).fill(state.start);
    for (let r = 0; r < state.rounds.length; r++) {
      for (let p = 0; p < n; p++) {
        const v = state.rounds[r][p];
        if (v > totals[p]) {
          bust[r][p] = true;
          continue;
        }
        totals[p] -= v;
        if (totals[p] === 0) return { totals, bust, zero: { round: r, player: p } };
      }
    }
    return { totals, bust, zero: null };
  }

  function best(state, totals) {
    const top = state.mode === "hoyest" ? Math.max(...totals) : Math.min(...totals);
    return totals.map((t, p) => (t === top ? p : -1)).filter((p) => p >= 0);
  }

  // Er spillet slutt, hvorfor, hvem vant, og hvem leder akkurat nå.
  function status(state) {
    const { totals, zero } = standing(state);
    const played = state.rounds.length;
    const leaders = played ? best(state, totals) : [];
    let reason = null;
    if (zero) reason = "zero";
    else if (state.target && played && totals.some((t) => t >= state.target)) reason = "target";
    else if (state.maxRounds && played >= state.maxRounds) reason = "rounds";
    else if (state.ended) reason = "ended";
    const winners = !reason ? [] : zero ? [zero.player] : best(state, totals);
    return { over: reason !== null, reason, winners, leaders, totals };
  }

  // Spillerne sortert fra best til dårligst. Likt gir samme plass.
  function ranking(state) {
    const { totals, zero } = standing(state);
    const sign = state.mode === "hoyest" ? -1 : 1;
    const first = zero ? zero.player : -1;
    const order = state.players
      .map((name, player) => ({ player, name, total: totals[player] }))
      .sort((a, b) => (b.player === first) - (a.player === first) || sign * (a.total - b.total) || a.player - b.player);
    order.forEach((row, i) => {
      const prev = order[i - 1];
      row.place = prev && prev.total === row.total && prev.player !== first ? prev.place : i + 1;
    });
    return order;
  }

  function setDraft(state, player, value) {
    if (!(player in state.players)) return state;
    const draft = state.draft.slice();
    draft[player] = toScore(value, state.mode);
    return { ...state, draft };
  }

  // Fører runden som er skrevet inn. Tomme felt teller som 0. En helt tom runde føres ikke.
  function commitRound(state) {
    if (status(state).over || state.draft.every((v) => v === null)) return state;
    return {
      ...state,
      rounds: [...state.rounds, state.draft.map((v) => (v === null ? 0 : v))],
      draft: state.players.map(() => null),
    };
  }

  // Retter en rute i en runde som alt er ført. Tomt felt blir 0.
  function setScore(state, round, player, value) {
    if (!(round in state.rounds) || !(player in state.players)) return state;
    const rounds = state.rounds.map((row) => row.slice());
    rounds[round][player] = toScore(value, state.mode) || 0;
    return { ...state, rounds };
  }

  function removeLastRound(state) {
    if (!state.rounds.length) return state;
    return { ...state, rounds: state.rounds.slice(0, -1), ended: false };
  }

  const end = (state) => (state.ended ? state : { ...state, ended: true });
  const resume = (state) => (state.ended ? { ...state, ended: false } : state);

  // Bygger tilstanden opp igjen fra lagrede data. Gir null hvis dataene ikke er et gyldig spill.
  function restore(data) {
    if (!data || !Array.isArray(data.players) || !data.players.length || data.players.length > MAX_PLAYERS) return null;
    if (!Array.isArray(data.rounds) || !Array.isArray(data.draft)) return null;
    const state = create(data);
    const n = state.players.length;
    if (data.draft.length !== n || data.rounds.some((row) => !Array.isArray(row) || row.length !== n)) return null;
    return {
      ...state,
      rounds: data.rounds.map((row) => row.map((v) => toScore(v, state.mode) || 0)),
      draft: data.draft.map((v) => toScore(v, state.mode)),
      ended: data.ended === true,
    };
  }

  return {
    MAX_PLAYERS, MAX_NAME, MODES, TEMPLATES,
    posInt, toScore, create, config, standing, status, ranking,
    setDraft, commitRound, setScore, removeLastRound, end, resume, restore,
  };
})();

if (typeof module !== "undefined") module.exports = Scorepad;
