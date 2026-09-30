# Asteroider – spilleregler

## Grunnreglene

Asteroider er et klassisk arkadespill fra 1979 (Atari, «Asteroids»). Reglene her er skrevet med egne ord.

- Du styrer et lite romskip i et felt fullt av asteroider.
- Skipet kan snu seg og skyte. Skuddene flyr rett frem og forsvinner etter en stund.
- En **stor** asteroide som blir truffet, deler seg i to **mellomstore**. En mellomstor deler seg i to **små**. En liten asteroide som blir truffet, forsvinner.
- Mindre asteroider er vanskeligere å treffe og gir **flere poeng**.
- Treffer en asteroide skipet, mister du et liv. Når alle livene er brukt opp, er spillet over.
- Når alle asteroidene er borte, kommer en ny og vanskeligere bølge.

## Vår versjon

- **Skipet står fast midt på brettet** og kan bare snu seg og skyte (ingen motor, ingen flytting).
- **Brettet** er kvadratisk, 600 × 600 enheter, med skipet i midten.
- **Styring:**
  - ← / → eller A / D snur skipet (ca. 230° i sekundet).
  - Mellomrom skyter. Holder du inne, skyter skipet med jevne mellomrom.
  - Trykk eller klikk på brettet: skipet snur seg mot punktet (raskere enn med tastene) og skyter når det peker dit. Holder du fingeren eller museknappen nede, fortsetter skipet å sikte mot den og skyte. Et kort trykk gir ett skudd.
- **Skudd:** høyst **4 skudd i lufta** samtidig, og minst **0,2 s** mellom hvert skudd (nedkjøling). Et skudd forsvinner når det treffer en asteroide eller går ut av brettet.
- **Asteroider** kommer inn fra en tilfeldig kant og sikter mot et punkt nær midten, så noen treffer skipet og noen suser forbi. En asteroide som har passert og er langt utenfor brettet, forsvinner uten poeng.
- **Deling:** stor → to mellomstore, mellomstor → to små, liten → borte. Bitene flyr litt ut til hver side og litt raskere enn den som ble truffet.
- **Poeng:** stor 20, mellomstor 50, liten 100.
- **Liv:** du har **3 liv**. Treffer en asteroide skipet, mister du ett liv, asteroiden knuses (uten poeng), og skipet er **usårbart i 2 sekunder** (det blinker). Mens skipet er usårbart, går asteroidene rett gjennom det.
- **Bølger:** bølge *n* har `4 + 2·(n − 1)` store asteroider som kommer inn én og én. For hver bølge kommer de tettere og fortere (farten øker med 12 % per bølge, tiden mellom dem går ned fra 2,0 s mot 0,6 s). Når alle asteroidene i en bølge er borte, er det 2 sekunders pause før neste bølge.
- **Grense:** det er aldri mer enn 60 asteroider på brettet (i praksis nås den ikke).
- **Spillet er over** når du har mistet alle tre livene. Det finnes ingen tidsgrense; de fleste spill varer noen få minutter fordi bølgene blir raskt vanskeligere.
- **Rekord:** høyeste poengsum.
- **Pause:** spillet står stille når fanen er skjult eller et kort er oppe.
