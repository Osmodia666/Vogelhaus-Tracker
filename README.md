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

## Datenquellen

- Kartendaten: © OpenStreetMap contributors
- Standort-, Status- und Fotodaten: eigene Supabase-Datenbank
