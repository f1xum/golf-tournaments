# Kampagnen-Links: woher kommen die Besucher?

Kurzfassung: **in der Instagram-Bio steht `thepin.app/ig`**, nicht `thepin.app`.
Dann steht im Admin-Dashboard unter „Woher kommen die Besucher“, wie viele
Besuche von Instagram kamen.

## Die Links

| Link | Zweck | landet auf | wird gezählt als |
|---|---|---|---|
| `thepin.app/ig` | Link in der Instagram-Bio | Startseite | Instagram · Kampagne `bio` |
| `thepin.app/ig?c=story` | Story-Sticker | Startseite | Instagram · Kampagne `story` |
| `thepin.app/ig?c=reel-okt` | einzelner Reel/Post | Startseite | Instagram · Kampagne `reel-okt` |
| `thepin.app/ig?c=story&to=/karte` | Story, die auf die Karte zeigt | `/karte` | Instagram · Kampagne `story` |

`c=` ist der Kampagnenname — frei wählbar, nur Kleinbuchstaben, Zahlen, `-`,
`_`, `.`. Er taucht genau so im Dashboard auf, also lohnt sich ein Name, den du
in vier Wochen noch erkennst (`reel-okt` statt `test2`).

`to=` ist die Zielseite, immer mit `/` beginnend und immer auf thepin.app —
externe Ziele werden absichtlich ignoriert (sonst wäre der Link ein
Weiterleitungs-Werkzeug für Phishing).

Der Link leitet weiter auf z. B.
`thepin.app/?utm_source=instagram&utm_medium=social&utm_campaign=bio`. Die
`utm_`-Parameter dürfen auch direkt verwendet werden — `/ig` ist nur die kurze,
in einer Bio lesbare Variante.

### Weiteren Kanal anlegen

`web/app/<slug>/route.ts` anlegen, z. B. für Facebook `web/app/fb/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { campaignRedirect, type CampaignChannel } from '@/lib/campaign-redirect';

const CHANNEL: CampaignChannel = { source: 'facebook', medium: 'social', defaultCampaign: 'bio' };

export function GET(request: NextRequest) {
  return campaignRedirect(request, CHANNEL);
}
```

## Was im Dashboard steht

- **Besuche** — wie viele Sitzungen von dieser Quelle gestartet sind. Das ist
  die Zahl, die „wie viele Leute kommen von Instagram“ am nächsten kommt.
- **Aufrufe** — wie viele Seiten diese Besucher insgesamt angesehen haben, und
  als Balken, wie viel davon auf eingeloggte Nutzer entfällt. Viele Aufrufe pro
  Besuch heißt: die Leute schauen sich um, statt sofort wieder zu gehen.
- **Kampagnen / Platzierungen** — dieselben Zahlen pro `c=`-Name, also Bio
  gegen Story gegen Reel.
- **Verweisende Seiten** — die Domains, von denen Klicks kamen, auch ohne
  Kampagnen-Link. So werden Links von Clubseiten oder Foren sichtbar.

## Grenzen (damit die Zahlen nicht überinterpretiert werden)

- Instagram und Facebook öffnen Links oft im **App-internen Browser** und
  schicken dann keine verweisende Domain mit. Erkannt wird das trotzdem, weil
  sich dieser Browser in der User-Agent-Kennung selbst benennt — aber wer den
  Link kopiert und später im Safari öffnet, zählt als „Direkt“.
- Eine Sitzung endet mit dem Tab. Wer morgens und abends kommt, sind zwei
  Besuche.
- Deine eigenen Aufrufe werden gar nicht gezählt: Admin-Accounts sind von der
  Messung ausgenommen (`web/lib/tracking-opt-out.ts`).
- Zahlen vor dem Deploy von Migration 027 haben keine Quelle und werden
  getrennt ausgewiesen, nicht als „Direkt“ mitgezählt.

## Wo das im Code liegt

| Datei | Aufgabe |
|---|---|
| `web/app/ig/route.ts` | der Kurzlink |
| `web/lib/campaign-redirect.ts` | hängt die `utm_`-Parameter an, prüft `to=` |
| `web/lib/traffic-source.ts` | bestimmt die Quelle im Browser, merkt sie für die Sitzung |
| `web/app/api/track/route.ts` | schreibt den Seitenaufruf samt Quelle |
| `db/migrations/027_traffic_source.sql` | Spalten + Auswertungs-Funktionen |
| `web/app/admin/client.tsx` | der Abschnitt „Woher kommen die Besucher“ |
