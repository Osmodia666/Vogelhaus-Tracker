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

export default function MapView({ birdhouses, onMarkerClick, center, zoom, selectedId, userPosition }) {
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('leaflet').then(L => {
      if (!mapRef.current) {
        const map = L.map('map-container', {
          center: center || [51.1657, 10.4515],
          zoom: zoom || (center ? 15 : 6),
          zoomControl: true,
        })
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map)
        mapRef.current = map
      }

      const map = mapRef.current
      if (center) map.setView(center, zoom || 15)

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
  }, [center, zoom, birdhouses, selectedId, userPosition])

  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }, [])

  return <div id="map-container" style={{ width: '100%', height: '100%' }} />
}
