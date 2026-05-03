import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'

const MapView = dynamic(() => import('../components/MapView'), { ssr: false })

const CATEGORY_META = {
  sight:    { label: 'Sehenswürdigkeit', color: '#4f9cf9', icon: '◈' },
  historic: { label: 'Historisch',        color: '#ff8c69', icon: '◆' },
  culture:  { label: 'Kultur/Museum',     color: '#b77dff', icon: '◉' },
  nature:   { label: 'Natur/Park',        color: '#7ed957', icon: '◎' },
  food:     { label: 'Restaurant/Café',   color: '#3ecf8e', icon: '○' },
  shop:     { label: 'Shopping',          color: '#f5a623', icon: '◇' },
}

// Focused OSM filters — fewer but better results
const OVERPASS_FILTERS = {
  sight: [
    'tourism=attraction',
    'tourism=viewpoint',
    'tourism=artwork',
  ],
  historic: [
    'historic=castle',
    'historic=monument',
    'historic=memorial',
    'historic=ruins',
    'historic=archaeological_site',
    'historic=building',
    'historic=fort',
  ],
  culture: [
    'tourism=museum',
    'tourism=gallery',
    'amenity=theatre',
    'amenity=arts_centre',
    'amenity=cinema',
  ],
  nature: [
    'leisure=park',
    'leisure=garden',
    'leisure=nature_reserve',
    'natural=peak',
    'natural=waterfall',
  ],
  food: [
    'amenity=restaurant',
    'amenity=cafe',
    'amenity=bar',
    'amenity=pub',
  ],
  shop: [
    'shop=mall',
    'shop=department_store',
    'shop=market',
  ],
}

function buildOverpassQuery(lat, lon, radiusM, categories) {
  const parts = []
  for (const cat of categories) {
    const filters = OVERPASS_FILTERS[cat] || []
    for (const f of filters) {
      const [k, v] = f.split('=')
      parts.push(`node["${k}"="${v}"](around:${radiusM},${lat},${lon});`)
      parts.push(`way["${k}"="${v}"](around:${radiusM},${lat},${lon});`)
    }
  }
  return `[out:json][timeout:25];(${parts.join('')});out center 60;`
}

function osmToCategory(tags) {
  if (tags.historic) return 'historic'
  if (tags.tourism === 'museum' || tags.tourism === 'gallery' || tags.amenity === 'theatre' || tags.amenity === 'arts_centre' || tags.amenity === 'cinema') return 'culture'
  if (tags.tourism === 'attraction' || tags.tourism === 'viewpoint' || tags.tourism === 'artwork') return 'sight'
  if (tags.leisure || tags.natural) return 'nature'
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'bar' || tags.amenity === 'pub') return 'food'
  if (tags.shop) return 'shop'
  return 'sight'
}

function parseOSMPlaces(elements) {
  const seen = new Set()
  return elements
    .filter(e => {
      if (!e.tags?.name) return false
      if (seen.has(e.tags.name)) return false
      seen.add(e.tags.name)
      return true
    })
    .map(e => {
      const lat = e.lat ?? e.center?.lat
      const lon = e.lon ?? e.center?.lon
      const cat = osmToCategory(e.tags)
      return {
        id: e.id,
        name: e.tags.name,
        lat, lon,
        category: cat,
        categoryLabel: CATEGORY_META[cat]?.label,
        website: e.tags.website || e.tags['contact:website'] || null,
        description: null,
        image: null,
      }
    })
    .filter(p => p.lat && p.lon)
    .slice(0, 40)
}

async function geocode(q) {
  const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
  const data = await r.json()
  if (!data?.length) throw new Error('Ort nicht gefunden')
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] }
}

async function fetchPOIs(lat, lon, radiusM, categories) {
  const query = buildOverpassQuery(lat, lon, radiusM, categories)
  const r = await fetch('/api/overpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
  const data = await r.json()
  return parseOSMPlaces(data.elements || [])
}

export default function Home() {
  const [mode, setMode] = useState('explore')
  const [cityInput, setCityInput] = useState('')
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [radius, setRadius] = useState(3000)
  const [activeFilters, setActiveFilters] = useState(['sight', 'historic', 'culture', 'nature'])
  const [places, setPlaces] = useState([])
  const [routePoints, setRoutePoints] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const [mapZoom] = useState(13)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [activeCard, setActiveCard] = useState(null)
  const [cityName, setCityName] = useState('')

  const toggleFilter = f => setActiveFilters(prev => prev.includes(f) ? prev.filter(c => c !== f) : [...prev, f])

  const loadExtras = async (rawPlaces, city) => {
    // Load descriptions
    try {
      const r = await fetch('/api/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: rawPlaces.slice(0, 20).map((p, i) => ({ name: p.name, category: p.categoryLabel, index: i + 1 })), city })
      })
      const data = await r.json()
      if (data.descriptions) {
        setPlaces(prev => prev.map((p, i) => ({ ...p, description: data.descriptions[i + 1] || p.description })))
      }
    } catch (e) { console.warn('Descriptions failed:', e.message) }

    // Load images in parallel (first 12 only)
    const imagePromises = rawPlaces.slice(0, 12).map(async (p, i) => {
      try {
        const r = await fetch(`/api/images?name=${encodeURIComponent(p.name)}`)
        const data = await r.json()
        return { i, image: data.image }
      } catch { return { i, image: null } }
    })
    const images = await Promise.allSettled(imagePromises)
    images.forEach(res => {
      if (res.status === 'fulfilled' && res.value.image) {
        setPlaces(prev => prev.map((p, idx) => idx === res.value.i ? { ...p, image: res.value.image } : p))
      }
    })
  }

  const doExplore = useCallback(async () => {
    if (!cityInput.trim()) return
    setLoading(true); setPlaces([]); setRoutePoints(null); setStatus('Ort wird gesucht...')
    try {
      const loc = await geocode(cityInput)
      setCityName(loc.name)
      setMapCenter([loc.lat, loc.lon])
      setStatus('Sehenswürdigkeiten werden geladen...')
      const cats = activeFilters.length ? activeFilters : Object.keys(CATEGORY_META)
      const raw = await fetchPOIs(loc.lat, loc.lon, radius, cats)
      setPlaces(raw)
      setStatus(`${raw.length} Orte gefunden — Beschreibungen & Bilder laden...`)
      if (raw.length > 0) await loadExtras(raw, loc.name)
      setStatus('')
    } catch (e) { setStatus('Fehler: ' + e.message) }
    setLoading(false)
  }, [cityInput, radius, activeFilters])

  const doRoute = useCallback(async () => {
    if (!startInput.trim() || !endInput.trim()) return
    setLoading(true); setPlaces([]); setStatus('Orte werden gesucht...')
    try {
      const [s, e] = await Promise.all([geocode(startInput), geocode(endInput)])
      setRoutePoints([{ lat: s.lat, lon: s.lon, name: s.name }, { lat: e.lat, lon: e.lon, name: e.name }])
      const midLat = (s.lat + e.lat) / 2, midLon = (s.lon + e.lon) / 2
      const dist = Math.sqrt(Math.pow((e.lat - s.lat) * 111000, 2) + Math.pow((e.lon - s.lon) * 85000, 2))
      const searchRadius = Math.min(Math.max(radius, dist * 0.4), 60000)
      const cats = activeFilters.length ? activeFilters : Object.keys(CATEGORY_META)
      const raw = await fetchPOIs(midLat, midLon, searchRadius, cats)
      setPlaces(raw)
      setCityName(`${s.name} → ${e.name}`)
      setStatus(`${raw.length} Orte gefunden — Beschreibungen & Bilder laden...`)
      if (raw.length > 0) await loadExtras(raw, `${s.name} bis ${e.name}`)
      setStatus('')
    } catch (e) { setStatus('Fehler: ' + e.message) }
    setLoading(false)
  }, [startInput, endInput, radius, activeFilters])

  const handleKey = e => { if (e.key === 'Enter') mode === 'explore' ? doExplore() : doRoute() }
  const filteredPlaces = places.filter(p => activeFilters.length === 0 || activeFilters.includes(p.category))

  return (
    <>
      <Head>
        <title>Detourly</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </Head>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 340, flexShrink: 0, background: 'var(--bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: 2.5, marginBottom: 5, textTransform: 'uppercase' }}>Detourly</div>
            <div style={{ fontSize: 19, fontWeight: 600 }}>Reiseziele entdecken</div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', padding: '10px 14px', gap: 6, borderBottom: '1px solid var(--border)' }}>
            {['explore','route'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '7px 0', borderRadius: 'var(--radius)',
                background: mode === m ? 'var(--bg3)' : 'transparent',
                border: `1px solid ${mode === m ? 'var(--border2)' : 'var(--border)'}`,
                color: mode === m ? 'var(--text)' : 'var(--muted)',
                fontSize: 13, fontWeight: mode === m ? 500 : 400, cursor: 'pointer',
              }}>
                {m === 'explore' ? '◎  Erkunden' : '◈  Route'}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div style={{ padding: '14px 14px 0', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
            {mode === 'explore' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={cityInput} onChange={e => setCityInput(e.target.value)} onKeyDown={handleKey} placeholder="Stadt eingeben, z.B. Wien..." />
                <button onClick={doExplore} disabled={loading} style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 15, flexShrink: 0, opacity: loading ? 0.6 : 1 }}>→</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#3ecf8e', flexShrink: 0 }} />
                  <input value={startInput} onChange={e => setStartInput(e.target.value)} onKeyDown={handleKey} placeholder="Startpunkt..." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f56', flexShrink: 0 }} />
                  <input value={endInput} onChange={e => setEndInput(e.target.value)} onKeyDown={handleKey} placeholder="Ziel..." />
                </div>
                <button onClick={doRoute} disabled={loading} style={{ padding: '9px', borderRadius: 'var(--radius)', background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 500, fontSize: 13, opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Lädt...' : 'Route berechnen →'}
                </button>
              </div>
            )}

            {/* Radius */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>Radius</span>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{(radius/1000).toFixed(1)} km</span>
              </div>
              <input type="range" min={500} max={20000} step={500} value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ padding: 0 }} />
            </div>

            {/* Filters */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>Kategorien</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <button key={k} onClick={() => toggleFilter(k)} style={{
                    padding: '4px 9px', borderRadius: 20, fontSize: 11,
                    background: activeFilters.includes(k) ? v.color + '20' : 'transparent',
                    border: `1px solid ${activeFilters.includes(k) ? v.color : 'var(--border)'}`,
                    color: activeFilters.includes(k) ? v.color : 'var(--muted)',
                    cursor: 'pointer',
                  }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div style={{ padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
              ⟳ {status}
            </div>
          )}

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
            {filteredPlaces.length === 0 && !loading && !status && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>◎</div>
                Gib einen Ort ein um zu starten.
              </div>
            )}
            {filteredPlaces.map((p, i) => {
              const meta = CATEGORY_META[p.category] || { label: 'Sonstiges', color: '#aaa' }
              const open = activeCard === i
              return (
                <div key={p.id || i} onClick={() => setActiveCard(open ? null : i)} style={{
                  borderRadius: 'var(--radius)', marginBottom: 5, overflow: 'hidden',
                  background: open ? 'var(--bg3)' : 'var(--bg2)',
                  border: `1px solid ${open ? 'var(--border2)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {/* Image */}
                  {open && p.image && (
                    <img src={p.image} alt={p.name} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                      onError={e => e.target.style.display = 'none'} />
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', lineHeight: 1.3 }}>{p.name}</div>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, flexShrink: 0, background: meta.color + '20', color: meta.color, fontFamily: 'var(--mono)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {meta.label}
                      </span>
                    </div>
                    {open && (
                      <div style={{ marginTop: 8 }}>
                        {p.description
                          ? <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>{p.description}</p>
                          : <p style={{ fontSize: 12, color: 'var(--border2)', fontStyle: 'italic', marginBottom: 8 }}>Keine Beschreibung verfügbar.</p>
                        }
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}&zoom=17`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)' }}>OSM →</a>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)' }}>Google Maps →</a>
                          {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)' }}>Website →</a>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            {filteredPlaces.length > 0 ? `${filteredPlaces.length} ORTE · ${cityName}` : 'OSM + GEMINI AI'}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView center={mapCenter} zoom={mapZoom} places={filteredPlaces} routePoints={routePoints} onMarkerClick={i => setActiveCard(i)} />
          {!mapCenter && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1000 }}>
              <div style={{ background: 'rgba(14,17,23,0.9)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 32px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--border2)', marginBottom: 10 }}>◎</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Gib einen Ort ein um zu starten</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
