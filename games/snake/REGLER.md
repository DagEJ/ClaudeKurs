# Snake – spilleregler

## Grunnreglene

- Du styrer en slange som kryper rundt på et rutebrett, ett steg av gangen.
- Slangen går hele tiden i samme retning til du svinger. Den kan svinge til venstre eller høyre, men ikke rygge rett tilbake.
- Et eple ligger i en tilfeldig ledig rute. Når slangen spiser det, blir den én rute lengre, og et nytt eple dukker opp.
- Krasjer slangen i kanten av brettet eller i sin egen kropp, er spillet slutt.
- Målet er å bli så lang som mulig.

## Vår versjon

- **Brett:** 15 × 15 ruter. Slangen starter midt på brettet, 3 ruter lang, med hodet mot høyre.
- **Start:** slangen står stille til du trykker en retning (piltast, WASD eller sveip). Trykker du rett bakover (venstre) ved start, skjer ingenting.
- **Vegger:** kanten er en vegg. Krasj i kanten eller i deg selv avslutter spillet.
- **Halen:** slangen kan gå inn i ruta der halen er akkurat nå, fordi halen flytter seg samme steg. (Det gjelder ikke når slangen spiser, men da står hodet på eplet og ikke på halen.)
- **Fart:** første steg tar 160 ms (ca. 6 ruter i sekundet). Hvert eple gjør steget 4 ms kortere, ned til 70 ms (ca. 14 ruter i sekundet), som nås etter 23 epler.
- **180°-regelen:** en sving rett bakover ignoreres, og slangen fortsetter som før. Det samme gjelder en sving i retningen den allerede går.
- **Tastekø:** opptil 2 svinger kan ligge i kø mellom to steg, slik at raske svinger (f.eks. opp og så venstre) virker. Hver sving sjekkes mot svingen foran den i køen.
- **Poeng:** 1 poeng per eple. Slangens lengde er alltid poeng + 3.
- **Rekord:** flest epler (poeng) i ett spill.
- **Fullt brett:** fyller slangen hele brettet, har du vunnet.
- **Pause:** mellomrom, P eller Pause-knappen. Spillet pauses også når siden skjules, og står stille mens et kort er oppe.
- **Styring:** piltaster eller WASD på tastatur, sveip på touch. Et kort med styringen vises før spillet starter.
