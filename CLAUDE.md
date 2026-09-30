# ClaudeKurs – minispill

En samling små enmannsspill som kan spilles på noen få minutter.
Ren HTML, CSS og JavaScript: ingen rammeverk, ingen byggesteg, ingen npm-avhengigheter.

## Struktur

```
index.html            Forside som lister alle spill (leser games/registry.js)
shared/style.css      Felles stil: farger, typografi, knapper, spill-layout
shared/common.js      Felles hjelpere (window.Common): rekord, formatering, tilfeldige tall
games/registry.js     Liste over spill som vises på forsiden
games/_mal/           Mal for nye spill – kopier denne, ikke endre den
games/<navn>/         Ett spill per mappe
```

Hvert spill har disse filene:

| Fil | Innhold |
|---|---|
| `index.html` | Siden: tilbake-lenke, tittel, status, spillflate, knapper |
| `logic.js` | **Ren spill-logikk.** Ingen DOM, ingen `window`, ingen tid/tilfeldighet som ikke sendes inn. |
| `game.js` | Tegning, input og spill-løkke. Kaller funksjoner i `logic.js`. |
| `style.css` | Kun det som er spesifikt for dette spillet. |
| `logic.test.js` | Tester for `logic.js` med Node sin innebygde testløper. |
| `REGLER.md` | *Valgfri.* Spillets regler, med en egen del «Vår versjon» for valgene vi har tatt. Er den der, er det den som gjelder – hold den og koden i takt. |

Eksisterende spill: `ludo` (du mot datamaskinen). Se `games/registry.js` for full liste.

Planlagte spill, i denne rekkefølgen (valgt 2026-09-30):
1. **2048** – øver på sveip/touch og piltaster.
2. **Fire på rad** – mot datamaskinen, med en motstander som tenker fremover (minimax) og vanskelighetsgrader.
3. **Minesveiper** – genererte brett der første klikk alltid er trygt; flagg med langt trykk på touch.

## Legge til et nytt spill

1. Kopier `games/_mal/` til `games/<navn>/` (små bokstaver, bindestrek, f.eks. `snake`, `minesweeper`).
2. Bytt ut malens logikk, tegning og tekst.
3. Legg spillet til i `games/registry.js`.
4. Kjør testene (se under) og åpne spillet i nettleseren.

## Konvensjoner

- **Ingen ES-moduler (`import`/`export`).** Sidene skal fungere når `index.html` åpnes direkte fra disk (`file://`), der moduler blokkeres. Bruk vanlige `<script>`-tagger.
- `logic.js` eksporterer ett objekt, og avslutter med
  `if (typeof module !== "undefined") module.exports = X;` slik at Node-testene kan laste den.
- Logikken er ren: den tar inn tilstand (og evt. tidssteg eller tilfeldig tall) og returnerer ny tilstand. Tid og tilfeldighet sendes inn fra `game.js`, slik at logikken kan testes.
- Bruk fargene og klassene i `shared/style.css` (CSS-variabler som `--accent`). Ikke hardkod farger i spillene.
  Spillerfarger finnes som `--p-red`, `--p-green`, `--p-yellow`, `--p-blue` og `--on-player` (tekst på brikker). Trengs nye farger, legg dem i `shared/style.css` for både lys og mørk modus.
- Motstander styrt av datamaskinen: la trekkvalget være en ren funksjon i `logic.js` (f.eks. `chooseMove(state)`) så den kan testes.
- Spill skal kunne spilles med både mus/touch og tastatur der det gir mening, og fungere på mobilbredde.
- **Før spillet starter** vises et kort intro-kort over spillflaten som forklarer hvordan spillet styres, både med taster og med touch. Bruk `Common.showOverlay(board, { title: "Slik spiller du", text, howto: [{ keys, text }], buttons })`. Taster skal ikke styre spillet mens kortet er oppe (`Common.isOverlayOpen(board)`).
- Slutt- og valgskjermer (tiden er ute, du vant, osv.) bruker også `Common.showOverlay`.
- Et spill skal ta **noen få minutter**. Hold det lite.
- Tekst i brukergrensesnittet er på norsk.
- Rekorder lagres med `Common.getBest` / `Common.saveBest` (tåler at localStorage mangler).

## Sjekke arbeidet

```
node --test
```

kjører alle `logic.test.js`. Alle tester skal passere før en endring commites.
(Ikke bruk `node --test games/` – en mappe som argument virker ikke i Node 22.)
En god test å ha med: simuler et helt spill med fast frø for tilfeldighet og sjekk at det blir ferdig.
Åpne også spillet i nettleseren og spill en runde: sjekk at det ikke er feil i konsollen.

## Publisering

Nettstedet kan publiseres med GitHub Pages fra `main`-grenen (roten).
`.nojekyll` gjør at mapper som starter med `_` (som `_mal`) også publiseres.
