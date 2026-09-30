# Slagskip (Battleship) – spilleregler

## Grunnreglene

- To spillere har hvert sitt kvadratiske brett (vanligvis 10×10) og hver sin flåte. Motstanderen ser ikke brettet ditt.
- Før kampen legger begge ut skipene sine. Et skip ligger rett, vannrett eller loddrett, og skip kan ikke overlappe.
- Spillerne skyter annenhver gang på én rute på motstanderens brett. Motstanderen svarer **bom** eller **treff**.
- Når alle rutene til et skip er truffet, er skipet **senket**, og det sies fra.
- Den som først senker hele flåten til motstanderen, vinner.

## Vår versjon

- **Brett 8×8** og **fire skip** på 4, 3, 3 og 2 ruter (12 ruter til sammen), så et spill tar noen få minutter.
- **Du mot datamaskinen.** Du skyter alltid først.
- **Du plasserer skipene selv:**
  - Velg et skip og trykk på ruten der det skal ligge. Ruten du trykker på, blir skipets øverste eller venstre ende.
  - Stikker skipet utenfor brettet, skyves det inn så det får plass.
  - «Roter» (eller `R`) bytter mellom vannrett og loddrett.
  - Trykk på et skip som ligger på brettet, for å løfte det opp og legge det et annet sted.
  - «Tilfeldig» legger ut hele flåten for deg.
  - Kampen kan ikke starte før alle fire skipene ligger på brettet.
  - Oppstillingen fra forrige spill ligger klar når du starter et nytt.
- **Skip kan ligge inntil hverandre**, også side om side. De kan ikke overlappe.
- Datamaskinens flåte legges ut tilfeldig.
- **Treff gir nytt skudd.** Turen går først over til motstanderen når du bommer. Det gjelder også datamaskinen.
- Du kan ikke skyte på samme rute to ganger.
- **Senket skip** vises tydelig på brettet, og det sies fra hvor langt skipet var.
- **Tre nivåer:**
  - **Lett:** skyter tilfeldig, og følger bare opp et treff annenhver gang.
  - **Middels:** leter i rutemønster (annenhver rute), og følger alltid opp et treff i rutene ved siden av – helst i forlengelsen av to treff på rad.
  - **Vanskelig:** regner ut hvor skipene som er igjen, kan ligge, og skyter der det er mest sannsynlig.
- Datamaskinen **jukser ikke**: den vet bare det du også ville visst – bom, treff og senket.
- Taper du, vises skipene du ikke fant.
- **Rekord:** lengste seiersrekke mot datamaskinen, egen rekord per nivå.
  - Seier øker rekken med 1. Tap nullstiller den.
  - Å starte et nytt spill eller bytte nivå etter at første skudd er avfyrt, teller som tap.
  - Rekken gjelder så lenge siden er åpen. Rekorden (den lengste rekken) lagres.
