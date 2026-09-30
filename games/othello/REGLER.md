# Othello – spilleregler

## Grunnreglene

- To spillere, mørk og lys, legger annenhver gang én brikke på et kvadratisk brett (vanligvis 8×8).
- Partiet starter med fire brikker i midten, to av hver farge, lagt på skrå for hverandre. Mørk begynner.
- Et trekk må **fange** minst én av motstanderens brikker: den nye brikken og en av dine egne brikker må ha en ubrutt rekke av motstanderens brikker mellom seg – vannrett, loddrett eller på skrå.
- Alle brikkene som fanges, i alle retninger, **snus** til din farge.
- Har du ingen lovlige trekk, må du **stå over**, og motstanderen trekker igjen. Har du et lovlig trekk, må du ta det.
- Partiet er slutt når ingen av spillerne kan trekke (som regel fordi brettet er fullt).
- Den som har **flest brikker** til slutt, vinner. Like mange er uavgjort.

## Vår versjon

- **Brett 6×6**, så et parti tar noen få minutter. Vanlig startoppstilling med fire brikker i midten.
- **Du mot datamaskinen.** Du er mørk og begynner alltid. Datamaskinen er lys.
- **Tre nivåer:**
  - **Lett:** tar trekket som snur flest brikker akkurat nå, og gjør ofte et tilfeldig trekk i stedet.
  - **Middels:** ser tre trekk frem og vet at hjørnene er verdifulle.
  - **Vanskelig:** ser seks trekk frem, og regner ut resten av partiet nøyaktig når ti ruter eller færre er ledige.
- **Lovlige trekk vises** som prikker på brettet når det er din tur. Bare de rutene kan velges.
- **Brikketellingen** for begge vises hele tiden.
- **Stå over:** har en spiller ingen lovlige trekk, står hen over automatisk, og det vises en tydelig melding om det. Kan ingen trekke, er partiet slutt.
- **Tomme ruter ved slutt** teller ikke for noen: det er bare brikkene på brettet som telles.
- **Ingen angre.**
- **Rekord:** lengste seiersrekke mot datamaskinen, egen rekord per nivå.
  - Seier øker rekken med 1.
  - Tap nullstiller rekken.
  - Uavgjort teller verken for eller mot: rekken står.
  - Å starte et nytt parti eller bytte nivå midt i et parti teller som tap.
  - Rekken gjelder så lenge siden er åpen. Rekorden (den lengste rekken) lagres.
- **Siste trekk** markeres på brettet.
