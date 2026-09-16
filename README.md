# Vogelhaus-Tracker

Eine mobile-first Web-App zur Dokumentation von Vogelhäusern an Bäumen: Standort per
GPS erfassen, Füllstand (voll/geleert) und Defekte festhalten, alles auf einer Karte
im Blick behalten — geräteübergreifend, da alle Daten in einer gemeinsamen Datenbank
liegen.

## Features

- **Standort per GPS erfassen**: Beim Anlegen eines neuen Vogelhauses wird der
  aktuelle Standort automatisch über das Handy-GPS ermittelt (`navigator.geolocation`).
- **Füllstand**: Jedes Vogelhaus wird als „Voll“ oder „Geleert“ markiert.
- **Defekt-Meldung**: Vogelhäuser können als defekt markiert werden, inkl. Notiz was
  repariert werden muss — auf der Karte deutlich rot hervorgehoben.
- **Foto-Upload**: Optional ein Foto vom Zustand/Defekt direkt von der Handykamera
  hochladen.
- **Karte mit Farbcodierung**: Grün = geleert/OK, Orange = voll, Rot = Defekt.
- **Liste + Filter**: Nach Status filtern (Alle / Voll / Defekt / OK).
- **Geräteübergreifend in Echtzeit**: Alle Standorte liegen in einer gemeinsamen
  Supabase-Datenbank — Änderungen werden per Realtime auf allen verbundenen Geräten
  sofort sichtbar.
- **Mobile-first UI**: Große Bedienelemente, optimiert für die Nutzung am Handy
  draußen im Wald/Garten; auf breiteren Bildschirmen automatisch ein Sidebar-Layout.
- **Eigene Forstbetriebskarte als Overlay**: Die Forstbetriebskarte „WG Eisern“ ist als
  georeferenziertes Overlay über der OpenStreetMap-Karte eingeblendet (ein-/ausblendbar,
  Deckkraft regelbar). Die Karte ist außerdem auf diesen Bereich begrenzt — kein Verirren
  auf der Weltkarte.
- **Kalibrierungsmodus**: Falls das Overlay nicht exakt zur echten Karte passt, lässt es
  sich über „Karte passt nicht? Kalibrieren“ per Hand verschieben und skalieren (Button
  unten links auf der Karte). Die Korrektur wird im Browser gespeichert; die berechneten
  Eckkoordinaten lassen sich zum dauerhaften Übernehmen kopieren.
- **Richtungsanzeige zum Vogelhaus**: Nach Auswahl eines Vogelhauses (Liste oder Karte)
  zeigt ein Kompasspfeil oben rechts Richtung (nach Norden ausgerichtet) und Entfernung
  ab dem eigenen GPS-Standort, der dabei laufend aktualisiert wird — zum Hinlaufen.

## Tech Stack

- **Next.js** 14 (React, Pages Router)
- **Leaflet / React-Leaflet** für die Karte (OpenStreetMap-Kacheln, kostenlos)
- **Supabase** (Postgres-Datenbank + Storage) für Standorte, Status und Fotos
- **Browser Geolocation API** für die GPS-Erfassung

## Setup

### 1. Supabase-Projekt einrichten

1. Kostenloses Projekt anlegen auf [supabase.com](https://supabase.com).
2. Im Dashboard unter **SQL Editor** → **New query** den Inhalt von
   [`supabase/schema.sql`](./supabase/schema.sql) einfügen und ausführen. Das legt an:
   - die Tabelle `birdhouses` (Standort, Status, Defekt, Foto-URL, Zeitstempel)
   - offene Lese-/Schreib-Policies (kein Login nötig — passend für private/Team-Nutzung)
   - Realtime-Sync für die Tabelle
   - einen öffentlichen Storage-Bucket `vogelhaus-fotos` für Fotos
3. Unter **Project Settings → API** die **Project URL** und den **anon public Key**
   kopieren.

> **Sicherheitshinweis:** Die Standard-Policies erlauben jedem mit dem anon key
> Lese-/Schreibzugriff (kein Login). Das ist bewusst einfach gehalten für private
> oder kleine Team-Nutzung. Für einen öffentlichen Einsatz sollte zusätzlich
> Supabase Auth eingerichtet und die Policies verschärft werden.

### 2. Umgebungsvariablen setzen

```bash
cp .env.local.example .env.local
```

`.env.local` ausfüllen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
```

### 3. Installieren & starten

```bash
npm install
npm run dev
```

Öffne http://localhost:3000 — am besten direkt vom Handy aus testen, damit das
GPS des Geräts genutzt wird (für den Standortzugriff im Browser ist eine
HTTPS-Verbindung nötig, `localhost` ist davon ausgenommen).

## Vercel Deployment

1. Repository auf GitHub pushen.
2. Auf [vercel.com](https://vercel.com) importieren.
3. Environment Variables setzen: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy — danach ist die App über HTTPS erreichbar, damit die Standort-Erfassung
   auf dem Handy funktioniert.

## Forstbetriebskarte austauschen

Die Kartendatei liegt unter [`public/forstkarte.jpg`](./public/forstkarte.jpg) und wird
in [`components/MapView.js`](./components/MapView.js) als Overlay über die vier
Eckkoordinaten `FOREST_MAP_BOUNDS` (Südwest-/Nordost-Ecke, WGS84 lat/lon) platziert.
Für eine andere oder aktualisierte Karte:

1. Neue Kartendatei (PDF/Bild) besorgen, idealerweise mit aufgedrucktem Koordinatengitter
   (z. B. UTM32N/ETRS89 wie bei der aktuellen Karte).
2. Anhand des Gitters die Eck-Koordinaten der Bildränder bestimmen und nach WGS84
   umrechnen (z. B. mit `pyproj`, `EPSG:25832` → `EPSG:4326`).
3. Bild als `public/forstkarte.jpg` (oder neuer Dateiname) ablegen, `FOREST_MAP_URL`,
   `FOREST_MAP_BOUNDS` und `PAN_BOUNDS` in `components/MapView.js` entsprechend anpassen.

## Datenquellen

- Kartendaten: © OpenStreetMap contributors
- Forstbetriebskarte: WG Eisern, RFA Siegen-Wittgenstein, FBB Siegen (24) ·
  AVH Forst / Kartographie Kitzing, Stand 01.01.2022
- Standort-, Status- und Fotodaten: eigene Supabase-Datenbank
