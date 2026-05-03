import { useEffect, useRef } from 'react'

const CATEGORY_COLORS = {
  sight:    '#4f9cf9',
  food:     '#3ecf8e',
  shop:     '#f5a623',
  nature:   '#7ed957',
  culture:  '#b77dff',
  historic: '#ff8c69',
  default:  '#aaaaaa',
}

function createIcon(L, category) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.default
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21S26 22.75 26 13C26 5.82 20.18 0 13 0z" fill="${color}" opacity="0.92"/>
    <circle cx="13" cy="13" r="5" fill="white" opacity="0.85"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -36] })
}

function createEndpointIcon(L, type) {
  const color = type === 'start' ? '#3ecf8e' : '#ff5f56'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26S32 28 32 16C32 7.16 24.84 0 16 0z" fill="${color}"/>
    <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -44] })
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
        // CartoDB Dark Matter — clean dark map
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO',
          subdomains: 'abcd',
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
          { color: '#4f9cf9', weight: 3, opacity: 0.6, dashArray: '8 6' }
        ).addTo(map)
        routeMarkersRef.current = [
          L.marker([routePoints[0].lat, routePoints[0].lon], { icon: createEndpointIcon(L, 'start') })
            .addTo(map).bindPopup(`<b style="color:#3ecf8e">Start</b><br>${routePoints[0].name}`),
          L.marker([routePoints[routePoints.length-1].lat, routePoints[routePoints.length-1].lon], { icon: createEndpointIcon(L, 'end') })
            .addTo(map).bindPopup(`<b style="color:#ff5f56">Ziel</b><br>${routePoints[routePoints.length-1].name}`),
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

function buildPopup(p) {
  const color = { sight:'#4f9cf9', food:'#3ecf8e', shop:'#f5a623', nature:'#7ed957', culture:'#b77dff', historic:'#ff8c69' }[p.category] || '#aaa'
  return `<div style="min-width:220px;max-width:280px;font-family:system-ui,sans-serif">
    ${p.image ? `<img src="${p.image}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:10px;display:block" onerror="this.style.display='none'"/>` : ''}
    <div style="font-weight:600;font-size:14px;color:#e8eaf0;margin-bottom:3px">${p.name}</div>
    <div style="font-size:10px;color:${color};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">${p.categoryLabel || p.category}</div>
    ${p.description ? `<div style="font-size:12px;color:#9aa3b8;line-height:1.55;margin-bottom:8px">${p.description}</div>` : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}&zoom=17" target="_blank" style="font-size:11px;color:#4f9cf9">OSM →</a>
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}" target="_blank" style="font-size:11px;color:#4f9cf9">Google Maps →</a>
      ${p.website ? `<a href="${p.website}" target="_blank" style="font-size:11px;color:#4f9cf9">Website →</a>` : ''}
    </div>
  </div>`
}
