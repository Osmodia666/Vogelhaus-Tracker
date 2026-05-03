import { useEffect, useRef } from 'react'

const CATEGORY_COLORS = {
  sight:    '#2563eb',
  food:     '#16a34a',
  shop:     '#d97706',
  nature:   '#15803d',
  culture:  '#7c3aed',
  historic: '#c2410c',
  default:  '#6b7280',
}

function createIcon(L, category) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.default
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="1.5" opacity="0.95"/>
    <circle cx="14" cy="14" r="5" fill="white" opacity="0.95"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -38] })
}

function createEndpointIcon(L, type) {
  const color = type === 'start' ? '#16a34a' : '#dc2626'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 27 17 27S34 29.75 34 17C34 7.61 26.39 0 17 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="17" cy="17" r="7" fill="white" opacity="0.95"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [34, 44], iconAnchor: [17, 44], popupAnchor: [0, -46] })
}

function buildPopup(p) {
  const color = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.default
  return `<div style="min-width:220px;max-width:280px;font-family:system-ui,sans-serif">
    ${p.image ? `<img src="${p.image}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:10px;display:block" onerror="this.style.display='none'"/>` : ''}
    <div style="font-weight:600;font-size:14px;color:#1e293b;margin-bottom:3px">${p.name}</div>
    <div style="font-size:10px;color:${color};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;font-weight:600">${p.categoryLabel || p.category}</div>
    ${p.description ? `<div style="font-size:12px;color:#475569;line-height:1.55;margin-bottom:8px">${p.description}</div>` : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}&zoom=17" target="_blank" style="font-size:11px;color:#2563eb">OSM →</a>
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}" target="_blank" style="font-size:11px;color:#2563eb">Google Maps →</a>
      ${p.website ? `<a href="${p.website}" target="_blank" style="font-size:11px;color:#2563eb">Website →</a>` : ''}
    </div>
  </div>`
}

export default function MapView({ center, zoom, places, routePoints, onMarkerClick }) {
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const routeMarkersRef = useRef([])
  const routeLineRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('leaflet').then(L => {
      if (!mapRef.current) {
        const map = L.map('map-container', {
          center: center || [48.2, 16.37],
          zoom: zoom || 13,
          zoomControl: true,
        })
        // Stadia Maps Outdoors — realistic, detailed, free, no API key needed
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map)
        mapRef.current = map
      }

      const map = mapRef.current
      if (center) map.setView(center, zoom || 13)

      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      routeMarkersRef.current.forEach(m => m.remove())
      routeMarkersRef.current = []
      if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null }

      if (routePoints && routePoints.length >= 2) {
        routeLineRef.current = L.polyline(
          routePoints.map(p => [p.lat, p.lon]),
          { color: '#2563eb', weight: 4, opacity: 0.7, dashArray: '10 6' }
        ).addTo(map)
        routeMarkersRef.current = [
          L.marker([routePoints[0].lat, routePoints[0].lon], { icon: createEndpointIcon(L, 'start') })
            .addTo(map).bindPopup(`<b style="color:#16a34a">Start</b><br>${routePoints[0].name}`),
          L.marker([routePoints[routePoints.length-1].lat, routePoints[routePoints.length-1].lon], { icon: createEndpointIcon(L, 'end') })
            .addTo(map).bindPopup(`<b style="color:#dc2626">Ziel</b><br>${routePoints[routePoints.length-1].name}`),
        ]
        map.fitBounds(L.latLngBounds(routePoints.map(p => [p.lat, p.lon])), { padding: [60, 60] })
      }

      if (places && places.length) {
        places.forEach((p, i) => {
          if (!p.lat || !p.lon) return
          const marker = L.marker([p.lat, p.lon], { icon: createIcon(L, p.category) })
            .addTo(map)
            .bindPopup(buildPopup(p), { maxWidth: 300 })
          marker.on('click', () => onMarkerClick && onMarkerClick(i))
          markersRef.current.push(marker)
        })
        if (!routePoints) {
          const valid = places.filter(p => p.lat && p.lon)
          if (valid.length) map.fitBounds(L.latLngBounds(valid.map(p => [p.lat, p.lon])), { padding: [80, 80] })
        }
      }
    })
  }, [center, zoom, places, routePoints])

  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }, [])

  return <div id="map-container" style={{ width: '100%', height: '100%' }} />
}
