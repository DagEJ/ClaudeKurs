const { test } = require("node:test");
const assert = require("node:assert/strict");
const Y = require("./logic.js");

// Forutsigbar «tilfeldighet» med fast frø.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// rand() som gir akkurat disse terningene, i rekkefølge.
function fixed(...values) {
  let i = 0;
  return () => (values[i++ % values.length] - 1) / 6 + 0.01;
}

// En runde der terningene er kastet og viser `dice`.
const rolled = (dice, base = Y.create()) => ({ ...base, dice, rollsLeft: 2 });
const ids = Y.CATEGORIES.map((c) => c.id);

// ---------- Skjema og runder ----------

test("skjemaet har 15 felt, og et nytt spill starter i runde 1 med tre kast", () => {
  const s = Y.create();
  assert.equal(Y.CATEGORIES.length, 15);
  assert.equal(s.round, 1);
  assert.equal(s.rollsLeft, 3);
  assert.equal(s.dice, null);
  assert.equal(s.status, "playing");
  assert.ok(ids.every((id) => s.scores[id] === null));
});

test("første kast kaster alle fem terningene", () => {
  const s = Y.roll(Y.create(), fixed(1, 2, 3, 4, 5));
  assert.deepEqual(s.dice, [1, 2, 3, 4, 5]);
  assert.equal(s.rollsLeft, 2);
});

test("terningene er alltid 1–6, også når rand() er helt i ytterkantene", () => {
  assert.deepEqual(Y.roll(Y.create(), () => 0).dice, [1, 1, 1, 1, 1]);
  assert.deepEqual(Y.roll(Y.create(), () => 0.999999).dice, [6, 6, 6, 6, 6]);
});

test("inntil tre kast per runde – det fjerde gjør ingenting", () => {
  let s = Y.create();
  for (let i = 0; i < 3; i++) s = Y.roll(s, seeded(i));
  assert.equal(s.rollsLeft, 0);
  assert.equal(Y.canRoll(s), false);
  assert.equal(Y.roll(s, seeded(9)), s);
});

test("holdte terninger blir liggende når du kaster", () => {
  let s = Y.roll(Y.create(), fixed(6, 6, 1, 2, 3));
  s = Y.toggleHold(Y.toggleHold(s, 0), 1);
  s = Y.roll(s, fixed(4, 4, 4));
  assert.deepEqual(s.dice, [6, 6, 4, 4, 4]);
  assert.deepEqual(s.held, [true, true, false, false, false]);
});

test("en holdt terning kan slippes igjen", () => {
  let s = Y.roll(Y.create(), fixed(3));
  s = Y.toggleHold(Y.toggleHold(s, 2), 2);
  assert.deepEqual(s.held, [false, false, false, false, false]);
});

test("du kan ikke holde før første kast eller etter det tredje", () => {
  const fresh = Y.create();
  assert.equal(Y.toggleHold(fresh, 0), fresh);
  let s = fresh;
  for (let i = 0; i < 3; i++) s = Y.roll(s, seeded(i));
  assert.equal(Y.toggleHold(s, 0), s);
});

test("holder du alle fem, kan du ikke kaste", () => {
  let s = Y.roll(Y.create(), fixed(2));
  for (let i = 0; i < 5; i++) s = Y.toggleHold(s, i);
  assert.equal(Y.canRoll(s), false);
  assert.equal(Y.roll(s, fixed(5)), s);
});

test("du må kaste minst én gang før du kan velge felt", () => {
  const s = Y.create();
  assert.equal(Y.canPlace(s, "sjanse"), false);
  assert.equal(Y.place(s, "sjanse"), s);
});

test("du kan velge felt etter første kast uten å bruke alle tre", () => {
  const s = Y.place(Y.roll(Y.create(), fixed(1, 2, 3, 4, 5)), "liten");
  assert.equal(s.scores.liten, 15);
  assert.equal(s.round, 2);
});

test("å velge felt starter neste runde: nye kast, ingen terninger, ingen holdt", () => {
  let s = Y.roll(Y.create(), fixed(5));
  s = Y.toggleHold(s, 0);
  s = Y.place(s, "femmere");
  assert.equal(s.scores.femmere, 25);
  assert.equal(s.dice, null);
  assert.equal(s.rollsLeft, 3);
  assert.deepEqual(s.held, [false, false, false, false, false]);
});

test("fritt valg: et felt kan fylles med 0 poeng", () => {
  const s = Y.place(rolled([1, 2, 3, 4, 6]), "yatzy");
  assert.equal(s.scores.yatzy, 0);
  assert.equal(s.round, 2);
});

test("et felt som er fylt, kan ikke endres", () => {
  const s = Y.place(rolled([6, 6, 6, 6, 6]), "seksere");
  const again = rolled([6, 6, 1, 1, 1], s);
  assert.equal(Y.canPlace(again, "seksere"), false);
  assert.equal(Y.place(again, "seksere"), again);
});

// ---------- Poeng per felt ----------

test("øvre del: summen av terningene som viser tallet", () => {
  const d = [1, 1, 3, 6, 6];
  assert.equal(Y.score(d, "enere"), 2);
  assert.equal(Y.score(d, "toere"), 0);
  assert.equal(Y.score(d, "treere"), 3);
  assert.equal(Y.score(d, "seksere"), 12);
  assert.equal(Y.score([5, 5, 5, 5, 5], "femmere"), 25);
  assert.equal(Y.score([4, 4, 4, 1, 2], "firere"), 12);
});

test("ett par gir det høyeste paret", () => {
  assert.equal(Y.score([2, 2, 5, 5, 1], "par"), 10);
  assert.equal(Y.score([1, 2, 3, 4, 6], "par"), 0);
});

test("tre, fire eller fem like teller også som et par", () => {
  assert.equal(Y.score([4, 4, 4, 1, 2], "par"), 8);
  assert.equal(Y.score([6, 6, 6, 6, 6], "par"), 12);
});

test("to par må være to ulike par", () => {
  assert.equal(Y.score([2, 2, 5, 5, 1], "topar"), 14);
  assert.equal(Y.score([3, 3, 3, 3, 1], "topar"), 0); // fire like er ikke to par
  assert.equal(Y.score([3, 3, 3, 3, 3], "topar"), 0);
  assert.equal(Y.score([6, 6, 1, 2, 3], "topar"), 0);
});

test("hus teller som to par", () => {
  assert.equal(Y.score([3, 3, 3, 5, 5], "topar"), 16);
});

test("tre like: bare de tre terningene teller", () => {
  assert.equal(Y.score([4, 4, 4, 6, 6], "trelike"), 12);
  assert.equal(Y.score([5, 5, 5, 5, 1], "trelike"), 15);
  assert.equal(Y.score([4, 4, 6, 6, 1], "trelike"), 0);
});

test("fire like: bare de fire terningene teller, og fem like er godkjent", () => {
  assert.equal(Y.score([2, 2, 2, 2, 6], "firelike"), 8);
  assert.equal(Y.score([6, 6, 6, 6, 6], "firelike"), 24);
  assert.equal(Y.score([2, 2, 2, 6, 6], "firelike"), 0);
});

test("liten straight er 1-2-3-4-5 og gir 15", () => {
  assert.equal(Y.score([5, 3, 1, 4, 2], "liten"), 15);
  assert.equal(Y.score([2, 3, 4, 5, 6], "liten"), 0);
  assert.equal(Y.score([1, 2, 3, 4, 4], "liten"), 0);
});

test("stor straight er 2-3-4-5-6 og gir 20", () => {
  assert.equal(Y.score([6, 2, 4, 3, 5], "stor"), 20);
  assert.equal(Y.score([1, 2, 3, 4, 5], "stor"), 0);
  assert.equal(Y.score([2, 3, 4, 5, 5], "stor"), 0);
});

test("hus er tre av én verdi og to av en annen, og gir summen av terningene", () => {
  assert.equal(Y.score([3, 3, 3, 5, 5], "hus"), 19);
  assert.equal(Y.score([6, 1, 6, 1, 6], "hus"), 20);
  assert.equal(Y.score([3, 3, 3, 5, 6], "hus"), 0);
  assert.equal(Y.score([3, 3, 5, 5, 6], "hus"), 0);
  assert.equal(Y.score([3, 3, 3, 3, 5], "hus"), 0);
});

test("fem like er ikke hus", () => {
  assert.equal(Y.score([4, 4, 4, 4, 4], "hus"), 0);
});

test("sjanse gir summen av alle fem", () => {
  assert.equal(Y.score([1, 2, 3, 4, 6], "sjanse"), 16);
});

test("yatzy er fem like og gir alltid 50", () => {
  assert.equal(Y.score([1, 1, 1, 1, 1], "yatzy"), 50);
  assert.equal(Y.score([6, 6, 6, 6, 6], "yatzy"), 50);
  assert.equal(Y.score([6, 6, 6, 6, 5], "yatzy"), 0);
});

test("ukjent felt gir feil", () => {
  assert.throws(() => Y.score([1, 1, 1, 1, 1], "tull"));
});

// ---------- Forhåndsvisning, bonus og sum ----------

test("forhåndsvisning viser hva hvert ledige felt ville gitt", () => {
  assert.deepEqual(Y.potential(Y.create()), {});
  let s = Y.place(rolled([1, 1, 1, 1, 1]), "enere");
  s = rolled([3, 3, 3, 5, 5], s);
  const p = Y.potential(s);
  assert.equal("enere" in p, false); // fylt felt er ikke med
  assert.equal(Object.keys(p).length, 14);
  assert.equal(p.treere, 9);
  assert.equal(p.hus, 19);
  assert.equal(p.topar, 16);
  assert.equal(p.yatzy, 0);
});

// Fyller øvre del med `n` like av hvert tall.
function upperWith(n) {
  let s = Y.create();
  Y.CATEGORIES.filter((c) => c.upper).forEach((c, i) => {
    const dice = [0, 1, 2, 3, 4].map((k) => (k < n[i] ? c.upper : c.upper === 6 ? 1 : 6));
    s = Y.place(rolled(dice, s), c.id);
  });
  return s;
}

test("bonus 50 ved nøyaktig 63 i øvre del", () => {
  const s = upperWith([3, 3, 3, 3, 3, 3]); // 3 + 6 + 9 + 12 + 15 + 18 = 63
  assert.equal(Y.upperSum(s), 63);
  assert.equal(Y.bonus(s), 50);
  assert.equal(Y.total(s), 113);
});

test("ingen bonus ved 62 i øvre del", () => {
  const s = upperWith([2, 3, 3, 3, 3, 3]);
  assert.equal(Y.upperSum(s), 62);
  assert.equal(Y.bonus(s), 0);
  assert.equal(Y.total(s), 62);
});

test("bonusen gis med en gang 63 er nådd, også om øvre del ikke er ferdig", () => {
  let s = Y.create();
  for (const [v, id] of [[6, "seksere"], [5, "femmere"], [4, "firere"]]) s = Y.place(rolled([v, v, v, v, v], s), id);
  assert.equal(Y.upperSum(s), 75);
  assert.equal(s.scores.enere, null);
  assert.equal(Y.bonus(s), 50);
});

test("nedre del teller ikke mot bonusen", () => {
  let s = Y.place(rolled([6, 6, 6, 6, 6]), "yatzy");
  s = Y.place(rolled([6, 6, 6, 6, 6], s), "sjanse");
  assert.equal(Y.upperSum(s), 0);
  assert.equal(Y.bonus(s), 0);
  assert.equal(Y.total(s), 80);
});

test("høyeste mulige sum er 374", () => {
  const best = {
    enere: [1, 1, 1, 1, 1], toere: [2, 2, 2, 2, 2], treere: [3, 3, 3, 3, 3], firere: [4, 4, 4, 4, 4],
    femmere: [5, 5, 5, 5, 5], seksere: [6, 6, 6, 6, 6], par: [6, 6, 6, 6, 6], topar: [6, 6, 5, 5, 5],
    trelike: [6, 6, 6, 6, 6], firelike: [6, 6, 6, 6, 6], liten: [1, 2, 3, 4, 5], stor: [2, 3, 4, 5, 6],
    hus: [6, 6, 6, 5, 5], sjanse: [6, 6, 6, 6, 6], yatzy: [6, 6, 6, 6, 6],
  };
  let s = Y.create();
  for (const id of ids) s = Y.place(rolled(best[id], s), id);
  assert.equal(s.status, "over");
  assert.equal(Y.total(s), 374);
});

// ---------- Helt spill ----------

test("spillet er over etter 15 runder, og da kan ingenting mer gjøres", () => {
  let s = Y.create();
  ids.forEach((id, i) => {
    assert.equal(s.round, i + 1);
    assert.equal(s.status, "playing");
    s = Y.place(Y.roll(s, seeded(i)), id);
  });
  assert.equal(s.status, "over");
  assert.equal(s.round, 15);
  assert.equal(Y.canRoll(s), false);
  assert.equal(Y.roll(s, seeded(1)), s);
  assert.equal(Y.toggleHold(s, 0), s);
  assert.equal(Y.place(s, "sjanse"), s);
});

test("et helt spill med fast frø blir ferdig, og summen stemmer hele veien", () => {
  for (const seed of [1, 2, 3, 42]) {
    const rand = seeded(seed);
    let s = Y.create();
    let steps = 0;
    while (s.status === "playing") {
      assert.ok(++steps < 500, "spillet ble ikke ferdig");
      const filled = ids.filter((id) => s.scores[id] !== null).length;
      assert.equal(filled, s.round - 1); // ett felt per runde
      assert.ok(s.rollsLeft >= 0 && s.rollsLeft <= 3);

      const r = rand();
      if (Y.canRoll(s) && (s.dice === null || r < 0.6)) {
        const before = s;
        s = Y.roll(s, rand);
        assert.ok(s.dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6));
        if (before.dice) before.held.forEach((h, i) => h && assert.equal(s.dice[i], before.dice[i]));
      } else if (Y.canHold(s) && r < 0.8) {
        s = Y.toggleHold(s, Math.floor(rand() * 5));
      } else {
        // Velg det ledige feltet som gir mest.
        const p = Y.potential(s);
        const id = Object.keys(p).sort((a, b) => p[b] - p[a])[0];
        s = Y.place(s, id);
        assert.equal(s.scores[id], p[id]);
      }
    }
    assert.equal(s.round, 15);
    const sum = ids.reduce((a, id) => a + s.scores[id], 0);
    assert.equal(Y.total(s), sum + (Y.upperSum(s) >= 63 ? 50 : 0));
    assert.ok(Y.total(s) >= 0 && Y.total(s) <= 374);
  }
});
