import { useEffect, useRef } from 'react'

const STATUS_COLOR = {
  ok:     '#3ecf8e',
  voll:   '#f5a623',
  defekt: '#ff5f56',
}

const STATUS_LABEL = {
  ok:     'Geleert',
  voll:   'Voll',
  defekt: 'Defekt',
}

export function getStatusKey(b) {
  if (b.has_defect) return 'defekt'
  return b.status === 'voll' ? 'voll' : 'ok'
}

// Georeferenzierung der Forstbetriebskarte (WG Eisern, Stand 01.01.2022).
// Ecken wurden anhand des aufgedruckten UTM32N/ETRS89-Gitters (Ost-/Nordwert)
// aus der Karte bestimmt und nach WGS84 (lat/lon) umgerechnet. Da das nur eine
// Näherung ist (Kartengitter leicht rotiert, Mess-Ungenauigkeit), kann die Karte
// im Kalibrierungsmodus per Hand nachjustiert werden (siehe applyCalibration unten).
export const FOREST_MAP_URL = '/forstkarte.jpg'
export const FOREST_MAP_ATTRIBUTION = 'Forstbetriebskarte WG Eisern · AVH Forst / Kartographie Kitzing, Stand 01.01.2022'
export const BASE_FOREST_MAP_BOUNDS = [
  [50.811285, 8.016916], // Südwest
  [50.850710, 8.064366], // Nordost
]
// Etwas großzügiger gefasster Bereich, außerhalb dessen nicht mehr gescrollt werden kann.
const PAN_BOUNDS = [
  [50.771570, 7.953190],
  [50.890430, 8.128090],
]
const FOREST_MAP_CENTER = [50.830900, 8.040640]

export const DEFAULT_CALIBRATION = { dLat: 0, dLng: 0, scale: 1 }

// Verschiebt/skaliert die Kartenecken um die im Kalibrierungsmodus eingestellten
// Korrekturwerte. dLat/dLng sind Grad-Offsets auf den Mittelpunkt, scale streckt/
// staucht die Karte gleichmäßig um diesen (ggf. verschobenen) Mittelpunkt.
export function applyCalibration(bounds, calibration) {
  const { dLat = 0, dLng = 0, scale = 1 } = calibration || {}
  const [[s, w], [n, e]] = bounds
  const centerLat = (s + n) / 2 + dLat
  const centerLng = (w + e) / 2 + dLng
  const halfLat = ((n - s) / 2) * scale
  const halfLng = ((e - w) / 2) * scale
  return [
    [centerLat - halfLat, centerLng - halfLng],
    [centerLat + halfLat, centerLng + halfLng],
  ]
}

// Meter in Grad-Offsets umrechnen (grobe, für diesen kleinen Bereich ausreichend genaue Näherung).
const METERS_PER_DEG_LAT = 111320
const METERS_PER_DEG_LNG = 111320 * Math.cos((FOREST_MAP_CENTER[0] * Math.PI) / 180)

export function nudgeCalibration(calibration, dxMeters, dyMeters) {
  return {
    ...calibration,
    dLng: (calibration.dLng || 0) + dxMeters / METERS_PER_DEG_LNG,
    dLat: (calibration.dLat || 0) + dyMeters / METERS_PER_DEG_LAT,
  }
}

export function scaleCalibration(calibration, factor) {
  return { ...calibration, scale: Math.max(0.8, Math.min(1.2, (calibration.scale ?? 1) * factor)) }
}

function createIcon(L, statusKey, selected) {
  const color = STATUS_COLOR[statusKey]
  const size = selected ? 34 : 28
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.28}" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="1.5" opacity="0.95"/>
    <path d="M9 19v-6l5-4 5 4v6h-3v-4h-4v4z" fill="white"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [size, size * 1.28], iconAnchor: [size / 2, size * 1.28], popupAnchor: [0, -size * 1.3] })
}

function createUserIcon(L) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="#4f9cf9" stroke="white" stroke-width="3"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })
}

function buildPopup(b) {
  const statusKey = getStatusKey(b)
  const checked = b.checked_at ? new Date(b.checked_at).toLocaleDateString('de-DE') : ''
  return `<div style="min-width:200px;max-width:260px;font-family:system-ui,sans-serif">
    ${b.photo_url ? `<img src="${b.photo_url}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px" onerror="this.style.display='none'"/>` : ''}
    <div style="font-weight:600;font-size:14px;color:#1e293b;margin-bottom:2px">${b.name || 'Vogelhaus'}</div>
    <div style="font-size:11px;font-weight:600;color:${STATUS_COLOR[statusKey]};margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">
      ${STATUS_LABEL[statusKey]}${b.has_defect && b.status === 'voll' ? ' · Voll' : ''}
    </div>
    ${b.defect_note ? `<div style="font-size:12px;color:#b91c1c;margin-bottom:4px">⚠ ${b.defect_note}</div>` : ''}
    ${b.note ? `<div style="font-size:12px;color:#475569;margin-bottom:6px">${b.note}</div>` : ''}
    <div style="font-size:10px;color:#94a3b8">Zuletzt geprüft: ${checked}</div>
  </div>`
}

export default function MapView({ birdhouses, onMarkerClick, center, zoom, selectedId, userPosition, showForestMap, forestOpacity, calibration }) {
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const forestLayerRef = useRef(null)
  const effectiveBounds = applyCalibration(BASE_FOREST_MAP_BOUNDS, calibration || DEFAULT_CALIBRATION)

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('leaflet').then(L => {
      if (!mapRef.current) {
        const map = L.map('map-container', {
          center: FOREST_MAP_CENTER,
          zoom: 14,
          zoomControl: true,
          maxBounds: PAN_BOUNDS,
          maxBoundsViscosity: 1.0,
          minZoom: 12,
        })
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map)
        map.fitBounds(effectiveBounds)
        mapRef.current = map
      }

      const map = mapRef.current
      if (center) map.setView(center, zoom || 15)

      if (!forestLayerRef.current) {
        forestLayerRef.current = L.imageOverlay(FOREST_MAP_URL, effectiveBounds, {
          opacity: forestOpacity ?? 0.7,
          attribution: FOREST_MAP_ATTRIBUTION,
        })
      } else {
        forestLayerRef.current.setBounds(effectiveBounds)
      }
      const forestLayer = forestLayerRef.current
      if (showForestMap === false) {
        if (map.hasLayer(forestLayer)) map.removeLayer(forestLayer)
      } else {
        if (!map.hasLayer(forestLayer)) forestLayer.addTo(map)
        forestLayer.setOpacity(forestOpacity ?? 0.7)
      }

      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      if (birdhouses && birdhouses.length) {
        birdhouses.forEach(b => {
          if (b.lat == null || b.lng == null) return
          const statusKey = getStatusKey(b)
          const marker = L.marker([b.lat, b.lng], { icon: createIcon(L, statusKey, b.id === selectedId) })
            .addTo(map)
            .bindPopup(buildPopup(b), { maxWidth: 300 })
          marker.on('click', () => onMarkerClick && onMarkerClick(b.id))
          markersRef.current.push(marker)
        })
        if (!center) {
          const valid = birdhouses.filter(b => b.lat != null && b.lng != null)
          if (valid.length) map.fitBounds(L.latLngBounds(valid.map(b => [b.lat, b.lng])), { padding: [60, 60] })
        }
      }

      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null }
      if (userPosition) {
        userMarkerRef.current = L.marker([userPosition.lat, userPosition.lng], { icon: createUserIcon(L), zIndexOffset: -100 })
          .addTo(map)
          .bindPopup('Dein Standort')
      }
    })
  }, [center, zoom, birdhouses, selectedId, userPosition, showForestMap, forestOpacity, calibration])

  useEffect(() => () => {
    // Refs müssen mit zurückgesetzt werden, sonst hält z.B. forestLayerRef nach einem
    // React-StrictMode-Doppel-Mount (dev) eine an die zerstörte Karte gebundene Leaflet-Instanz fest.
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    forestLayerRef.current = null
    markersRef.current = []
    userMarkerRef.current = null
  }, [])

  // Größe neu berechnen bei jeder Änderung des Containers (Fenster-Resize, Listen-Panel auf/zu, Rotation).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
    const el = document.getElementById('map-container')
    if (!el) return
    const observer = new ResizeObserver(() => { mapRef.current?.invalidateSize() })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return <div id="map-container" style={{ width: '100%', height: '100%' }} />
}
