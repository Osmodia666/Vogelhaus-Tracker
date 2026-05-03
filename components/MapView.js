import { useEffect, useRef } from 'react'

const CATEGORY_COLORS = {
  sight:    '#4f9cf9',
  food:     '#3ecf8e',
  shop:     '#f5a623',
  nature:   '#7ed957',
  culture:  '#b77dff',
  default:  '#aaaaaa',
}

function createIcon(L, category) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.default
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="${color}" opacity="0.95"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  })
}

function createRouteIcon(L, type) {
  const color = type === 'start' ? '#3ecf8e' : '#ff5f56'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26S32 28 32 16C32 7.16 24.84 0 16 0z" fill="${color}"/>
    <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -42] })
}

export default function MapView({ center, zoom, places, routePoints, onMarkerClick }) {
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markersRef = useRef([])
  const routeMarkersRef = useRef([])
  const routeLineRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('leaflet').then(L => {
      leafletRef.current = L

      if (!mapRef.current) {
        const map = L.map('map-container', {
          center: center || [48.2, 16.37],
          zoom: zoom || 13,
          zoomControl: true,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)
        mapRef.current = map
      }

      const map = mapRef.current

      if (center) {
        map.setView(center, zoom || 13)
      }

      // Clear old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      routeMarkersRef.current.forEach(m => m.remove())
      routeMarkersRef.current = []
      if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null }

      // Draw route line
      if (routePoints && routePoints.length >= 2) {
        routeLineRef.current = L.polyline(routePoints.map(p => [p.lat, p.lon]), {
          color: '#4f9cf9',
          weight: 3,
          opacity: 0.6,
          dashArray: '8 6',
        }).addTo(map)

        const startM = L.marker([routePoints[0].lat, routePoints[0].lon], { icon: createRouteIcon(L, 'start') })
          .addTo(map)
          .bindPopup(`<b style="color:#3ecf8e">Start</b><br>${routePoints[0].name}`)
        const endM = L.marker([routePoints[routePoints.length-1].lat, routePoints[routePoints.length-1].lon], { icon: createRouteIcon(L, 'end') })
          .addTo(map)
          .bindPopup(`<b style="color:#ff5f56">Ziel</b><br>${routePoints[routePoints.length-1].name}`)
        routeMarkersRef.current = [startM, endM]

        const bounds = L.latLngBounds(routePoints.map(p => [p.lat, p.lon]))
        map.fitBounds(bounds, { padding: [60, 60] })
      }

      // Draw POI markers
      if (places && places.length) {
        places.forEach((p, i) => {
          if (!p.lat || !p.lon) return
          const icon = createIcon(L, p.category)
          const popupContent = `
            <div style="min-width:200px;max-width:260px">
              <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:#e8eaf0">${p.name}</div>
              <div style="font-size:11px;color:#7a8399;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">${p.categoryLabel || p.category}</div>
              ${p.description ? `<div style="font-size:13px;color:#b0b8cc;line-height:1.5;margin-bottom:8px">${p.description}</div>` : '<div style="font-size:13px;color:#5a6378;font-style:italic;margin-bottom:8px">Beschreibung wird geladen...</div>'}
              ${p.website ? `<a href="${p.website}" target="_blank" style="font-size:12px;color:#4f9cf9">Website →</a>` : ''}
            </div>`
          const marker = L.marker([p.lat, p.lon], { icon })
            .addTo(map)
            .bindPopup(popupContent, { maxWidth: 280 })
          marker.on('click', () => onMarkerClick && onMarkerClick(i))
          markersRef.current.push(marker)
        })

        if (!routePoints && places.length > 0) {
          const bounds = L.latLngBounds(places.filter(p=>p.lat).map(p => [p.lat, p.lon]))
          map.fitBounds(bounds, { padding: [80, 80] })
        }
      }
    })
  }, [center, zoom, places, routePoints])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return <div id="map-container" style={{ width: '100%', height: '100%' }} />
}
