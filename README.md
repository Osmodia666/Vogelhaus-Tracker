# Travel Explorer

Eine Reiseziel-App mit interaktiver Karte, echten OpenStreetMap-Daten und KI-generierten Beschreibungen.

## Features

- **Erkunden-Modus**: Stadt eingeben → Sehenswürdigkeiten, Restaurants, Natur etc. auf der Karte
- **Routen-Modus**: Start + Ziel → interessante Stopps entlang der Strecke
- **Radius-Filter**: 0,5 km bis 20 km einstellbar
- **Kategorie-Filter**: Sehenswürdigkeiten, Restaurants, Shopping, Natur, Kultur
- **KI-Beschreibungen**: Claude generiert kurze Infotexte zu jedem Ort
- **Dark Industrial UI** mit OpenStreetMap-Karte

## Setup

```bash
npm install
```

Erstelle eine `.env.local` Datei:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

## Lokaler Start

```bash
npm run dev
```

Öffne http://localhost:3000

## Vercel Deployment

1. Repository auf GitHub pushen
2. Auf [vercel.com](https://vercel.com) importieren
3. Environment Variable setzen: `ANTHROPIC_API_KEY`
4. Deploy!

## Tech Stack

- **Next.js** 14 (React)
- **Leaflet / React-Leaflet** für die Karte
- **OpenStreetMap** Tiles (kostenlos)
- **Nominatim** für Geocoding (kostenlos)
- **Overpass API** für POI-Daten (kostenlos)
- **Claude API** für Beschreibungen

## Datenquellen

- Kartendaten: © OpenStreetMap contributors
- POIs: Overpass API (OSM)
- Beschreibungen: Anthropic Claude
