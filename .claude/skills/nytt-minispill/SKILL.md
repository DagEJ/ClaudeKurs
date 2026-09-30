---
name: nytt-minispill
description: Legg inn et nytt spill i ClaudeKurs, fra idé til testet og pushet spill – regler i REGLER.md, avklaring av åpne valg med brukeren, ren logikk med tester, side med introkort, oppføring på forsiden og automatisk sjekk i ekte nettleser. Bruk dette når brukeren vil lage, legge til, bygge eller starte på et spill i dette repoet («lag Fire på rad», «neste spill», «legg inn Minesveiper», «kan vi lage Snake?»), også når de bare nevner et spillnavn fra planen i CLAUDE.md.
---

# Nytt minispill

CLAUDE.md sier hvordan koden i et spill skal se ut. Dette skillet sier **i hvilken rekkefølge** et nytt spill bygges, og **hvordan det sjekkes** før det leveres. Les CLAUDE.md først hvis den ikke allerede er i konteksten; ikke gjenta reglene derfra her.

Rekkefølgen er bevisst: regler før kode, logikk før tegning, sjekk før commit. Hvert steg er billig å rette mens det pågår og dyrt å rette når neste steg er bygd oppå.

Lag en oppgaveliste med de fem stegene, så brukeren ser hvor langt du har kommet.

## 1. Regler og åpne valg – før du skriver kode

1. Finn reglene: fra brukeren, fra en nettside de peker på (skriv med egne ord og oppgi kilden), eller fra det du vet om spillet.
2. Skriv `games/<id>/REGLER.md` med to deler:
   - **Grunnreglene** – spillet slik det vanligvis spilles.
   - **Vår versjon** – valgene som gjelder her. Denne delen er fasiten for koden og testene.
3. Finn valgene som faktisk endrer koden, og spør brukeren om dem (AskUserQuestion, maks fire spørsmål). Typiske:
   - Motstander: alene, eller mot datamaskinen? Vanskelighetsgrader?
   - Lengde: CLAUDE.md sier «noen få minutter». Trengs tidsgrense, mindre brett eller færre brikker?
   - Husregler og varianter.
   - Kanttilfeller reglene ikke avgjør (hva skjer ved uavgjort, ved for høyt kast, osv.).
   - Hva er rekorden (poeng, tid, antall trekk)?

   Ikke spør om ting CLAUDE.md allerede avgjør (teknologi, farger, språk, intro).

   Grunnen: i ludo måtte en regel om trygge felt bygges om etter at spillet var ferdig. Et spørsmål på forhånd koster ti sekunder.

   Er brukeren ikke til stede, velg det enkleste alternativet og skriv valget inn i «Vår versjon», så det er synlig.

## 2. Logikk og tester

1. Skriv `games/<id>/logic.js` etter CLAUDE.md: ren tilstand inn, ny tilstand ut. Send inn tilfeldighet som en `rand()`-funksjon eller som tall, og tid som millisekunder.
2. Motstander: `chooseMove(state, nivå)` som ren funksjon, så den kan testes med kjente stillinger.
3. Skriv `games/<id>/logic.test.js`:
   - Én test per regel i «Vår versjon», med testnavn som sier regelen på norsk.
   - Kanttilfellene fra steg 1.
   - Et helt spill simulert med fast frø, som må bli ferdig. Sjekk en invariant i hvert steg (f.eks. aldri to brikker i samme rute).
   - For motstanderen: at den tar en vinnende stilling og blokkerer en tapende.
4. Kjør `node --test` til alt er grønt **før** du går videre. Feil i logikken er mye vanskeligere å finne når det ligger tegning og animasjon oppå.

Felle vi har gått i: etter et kast eller trekk kan turen ha gått over til neste spiller. Sjekk tilstanden til riktig spiller i testene.

## 3. Side, tegning og intro

1. Kopier `games/_mal/` til `games/<id>/` og bytt ut innholdet.
2. Alt man kan klikke på i spillet, skal være `<button>`. Da virker tastatur og skjermleser, og sjekkskriptet i steg 4 finner det.
3. Introkort med `Common.showOverlay` før spillet starter (se CLAUDE.md). Hold det kort: 1–2 setninger og 2–4 rader med taster/touch. Kortet må få plass inni brettet på en mobil som er 390 px bred.
4. Slutt- og valgkort (vant, tapte, tiden er ute) også med `Common.showOverlay`.
5. Tidtakere skal stå stille når `document.hidden` er sant eller et kort er oppe.
6. Farger fra variablene i `shared/style.css`. Trengs nye, legg dem der for både lys og mørk modus.
7. Legg spillet til i `games/registry.js` (id, tittel, emoji, minutter, kort beskrivelse).

## 4. Sjekk i nettleser

Kjør fra roten av repoet:

```
node .claude/skills/nytt-minispill/scripts/sjekk-i-nettleser.js <id>
```

Skriptet åpner spillet på PC (lys) og mobil (mørk), sjekker introkortet og at taster er blokkert mens det er oppe, spiller tilfeldig i 300 steg (taster, knapper, sveip, lange trykk), spoler klokka og tar skjermbilder. Det avslutter med kode 1 og skriver `FUNN:` hvis noe er galt. Valg: `--steps 500`, `--seed 2`, `--out mappe`.

Etterpå:

1. Se på skjermbildene med Read, minst `mobil-mork-intro.png` og `pc-lys-underveis.png`. Se etter overlapp, tekst som er kuttet, dårlig kontrast i mørk modus og kort som dekker for mye.
2. Rett funn og kjør på nytt.
3. Skriptet spiller tilfeldig, så det finner krasj og layoutfeil, men ikke om en bestemt flyt virker. Har spillet en egen flyt (tiden er ute → fortsett, datamaskinen vinner → nytt spill), skriv en kort, målrettet Playwright-sjekk for den i en midlertidig mappe. Bruk `page.clock.install()` og `page.clock.runFor(ms)` for å spole tid, og `click({ force: true })` på elementer som animeres (ellers venter Playwright på at de står stille).

Mangler Playwright, sier skriptet fra. Kjør da `node --test`, og be brukeren åpne spillet og spille en runde.

## 5. Commit, push og rapport

1. `git status`. Commit spillmappen, `games/registry.js` og eventuelle endringer i `shared/`. Skriv commit-meldingen på norsk med en kort punktliste over hva spillet gjør.
2. Oppdater CLAUDE.md: flytt spillet fra «Planlagte spill» til «Eksisterende spill».
3. `git pull --rebase` og `git push`.
4. Rapporter kort til brukeren:
   - hva spillet gjør og hvordan det styres
   - valg du tok selv (de står også i «Vår versjon»)
   - testresultat og nettlesersjekk
   - ett skjermbilde med SendUserFile
   - påminnelse om `git pull` i VS Code

## Senere endringer i et spill

Når brukeren vil endre en regel: endre `REGLER.md` («Vår versjon»), logikken og testene i samme commit, og kjør steg 4 på nytt. Da er reglene, koden og testene alltid enige.
