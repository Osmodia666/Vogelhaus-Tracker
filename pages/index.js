import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'

const MapView = dynamic(() => import('../components/MapView'), { ssr: false })

const CATEGORY_META = {
  sight:   { label: 'Sehenswürdigkeit', color: '#4f9cf9', icon: '◈' },
  food:    { label: 'Restaurant/Café',   color: '#3ecf8e', icon: '◎' },
  shop:    { label: 'Shopping',          color: '#f5a623', icon: '◇' },
  nature:  { label: 'Natur',             color: '#7ed957', icon: '◉' },
  culture: { label: 'Kultur/Museum',     color: '#b77dff', icon: '◆' },
  default: { label: 'Sonstiges',         color: '#aaaaaa', icon: '○' },
}

const OVERPASS_FILTERS = {
  sight:   ['tourism~"attraction|viewpoint|monument|castle|ruins"', 'historic~"castle|monument|memorial|ruins|archaeological_site"'],
  food:    ['amenity~"restaurant|cafe|bar|fast_food|pub"'],
  shop:    ['shop~"mall|department_store|market|supermarket|clothes|books"'],
  nature:  ['leisure~"park|garden|nature_reserve"', 'natural~"peak|waterfall|cave_entrance|wood"'],
  culture: ['tourism~"museum|gallery|theatre|artwork"', 'amenity~"theatre|cinema|arts_centre"'],
}

function buildOverpassQuery(lat, lon, radiusM, categories) {
  const filters = categories.flatMap(c => OVERPASS_FILTERS[c] || [])
  const parts = filters.map(f => `node[${f}](around:${radiusM},${lat},${lon});`)
  return `[out:json][timeout:25];(${parts.join('')});out body 60;`
}

function osmToCategory(tags) {
  if (tags.tourism === 'museum' || tags.amenity === 'theatre' || tags.amenity === 'arts_centre' || tags.tourism === 'gallery') return 'culture'
  if (tags.tourism || tags.historic) return 'sight'
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'bar' || tags.amenity === 'pub' || tags.amenity === 'fast_food') return 'food'
  if (tags.shop) return 'shop'
  if (tags.leisure || tags.natural) return 'nature'
  return 'default'
}

function parseOSMPlaces(elements) {
  return elements
    .filter(e => e.tags && e.tags.name)
    .map(e => ({
      id: e.id,
      name: e.tags.name,
      lat: e.lat,
      lon: e.lon,
      category: osmToCategory(e.tags),
      categoryLabel: CATEGORY_META[osmToCategory(e.tags)]?.label,
      website: e.tags.website || e.tags['contact:website'] || null,
      description: null,
    }))
    .slice(0, 40)
}

async function geocode(q) {
  const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
  const data = await r.json()
  if (!data || !data.length) throw new Error('Ort nicht gefunden')
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] }
}

async function fetchPOIs(lat, lon, radiusM, categories) {
  const query = buildOverpassQuery(lat, lon, radiusM, categories)
  const r = await fetch('/api/overpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
  const data = await r.json()
  return parseOSMPlaces(data.elements || [])
}

async function fetchDescriptions(places, city) {
  const r = await fetch('/api/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ places: places.map((p, i) => ({ name: p.name, category: p.categoryLabel, index: i + 1 })), city })
  })
  const data = await r.json()
  return data.descriptions || {}
}

export default function Home() {
  const [mode, setMode] = useState('explore')
  const [cityInput, setCityInput] = useState('')
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [radius, setRadius] = useState(3000)
  const [activeFilters, setActiveFilters] = useState(['sight', 'food', 'nature', 'culture', 'shop'])
  const [places, setPlaces] = useState([])
  const [routePoints, setRoutePoints] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const [mapZoom, setMapZoom] = useState(13)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [activeCard, setActiveCard] = useState(null)
  const [cityName, setCityName] = useState('')

  const toggleFilter = (cat) => {
    setActiveFilters(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  const doExplore = useCallback(async () => {
    if (!cityInput.trim()) return
    setLoading(true)
    setPlaces([])
    setRoutePoints(null)
    setStatus('Ort wird gesucht...')
    try {
      const loc = await geocode(cityInput)
      setCityName(loc.name)
      setMapCenter([loc.lat, loc.lon])
      setMapZoom(14)
      setStatus('Sehenswürdigkeiten werden geladen...')
      const cats = activeFilters.length ? activeFilters : ['sight', 'food', 'nature', 'culture', 'shop']
      const raw = await fetchPOIs(loc.lat, loc.lon, radius, cats)
      setPlaces(raw)
      setStatus(`${raw.length} Orte gefunden. Beschreibungen werden geladen...`)
      if (raw.length > 0) {
        const descs = await fetchDescriptions(raw.slice(0, 20), loc.name)
        setPlaces(prev => prev.map((p, i) => ({ ...p, description: descs[i + 1] || null })))
      }
      setStatus('')
    } catch (e) {
      setStatus('Fehler: ' + e.message)
    }
    setLoading(false)
  }, [cityInput, radius, activeFilters])

  const doRoute = useCallback(async () => {
    if (!startInput.trim() || !endInput.trim()) return
    setLoading(true)
    setPlaces([])
    setStatus('Startpunkt wird gesucht...')
    try {
      const [startLoc, endLoc] = await Promise.all([geocode(startInput), geocode(endInput)])
      const pts = [
        { lat: startLoc.lat, lon: startLoc.lon, name: startLoc.name },
        { lat: endLoc.lat,   lon: endLoc.lon,   name: endLoc.name },
      ]
      setRoutePoints(pts)
      setStatus('POIs entlang der Route werden gesucht...')
      const midLat = (startLoc.lat + endLoc.lat) / 2
      const midLon = (startLoc.lon + endLoc.lon) / 2
      const dist = Math.sqrt(Math.pow((endLoc.lat - startLoc.lat) * 111000, 2) + Math.pow((endLoc.lon - startLoc.lon) * 85000, 2))
      const searchRadius = Math.min(Math.max(radius, dist * 0.3), 50000)
      const cats = activeFilters.length ? activeFilters : ['sight', 'food', 'nature', 'culture', 'shop']
      const raw = await fetchPOIs(midLat, midLon, searchRadius, cats)
      setPlaces(raw)
      setCityName(`${startLoc.name} → ${endLoc.name}`)
      setStatus(`${raw.length} Orte gefunden. Beschreibungen werden geladen...`)
      if (raw.length > 0) {
        const descs = await fetchDescriptions(raw.slice(0, 20), `${startLoc.name} bis ${endLoc.name}`)
        setPlaces(prev => prev.map((p, i) => ({ ...p, description: descs[i + 1] || null })))
      }
      setStatus('')
    } catch (e) {
      setStatus('Fehler: ' + e.message)
    }
    setLoading(false)
  }, [startInput, endInput, radius, activeFilters])

  const handleKey = (e) => { if (e.key === 'Enter') mode === 'explore' ? doExplore() : doRoute() }

  return (
    <>
      <Head>
        <title>Travel Explorer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </Head>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: 360,
          flexShrink: 0,
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
              Travel Explorer
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Reiseziele entdecken</div>
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', padding: '12px 20px', gap: 8, borderBottom: '1px solid var(--border)' }}>
            {['explore', 'route'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '8px 0', borderRadius: 'var(--radius)',
                background: mode === m ? 'var(--bg3)' : 'transparent',
                border: mode === m ? '1px solid var(--border2)' : '1px solid var(--border)',
                color: mode === m ? 'var(--text)' : 'var(--muted)',
                fontSize: 13, fontWeight: mode === m ? 500 : 400,
                fontFamily: 'var(--sans)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {m === 'explore' ? '◎  Erkunden' : '◈  Route'}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            {mode === 'explore' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={cityInput}
                  onChange={e => setCityInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Stadt, z.B. Wien oder Salzburg..."
                />
                <button onClick={doExplore} disabled={loading} style={{
                  padding: '10px 14px', borderRadius: 'var(--radius)',
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  fontWeight: 500, fontSize: 14, flexShrink: 0,
                  opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? '...' : '→'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3ecf8e', flexShrink: 0 }} />
                  <input value={startInput} onChange={e => setStartInput(e.target.value)} onKeyDown={handleKey} placeholder="Startpunkt..." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56', flexShrink: 0 }} />
                  <input value={endInput} onChange={e => setEndInput(e.target.value)} onKeyDown={handleKey} placeholder="Ziel..." />
                </div>
                <button onClick={doRoute} disabled={loading} style={{
                  padding: '10px', borderRadius: 'var(--radius)',
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  fontWeight: 500, fontSize: 14, opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? 'Lädt...' : 'Route berechnen →'}
                </button>
              </div>
            )}

            {/* Radius */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>RADIUS</span>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{(radius / 1000).toFixed(1)} km</span>
              </div>
              <input type="range" min={500} max={20000} step={500} value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                style={{ padding: 0 }}
              />
            </div>

            {/* Category filters */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 8 }}>KATEGORIEN</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(CATEGORY_META).filter(([k]) => k !== 'default').map(([k, v]) => (
                  <button key={k} onClick={() => toggleFilter(k)} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12,
                    background: activeFilters.includes(k) ? v.color + '22' : 'transparent',
                    border: `1px solid ${activeFilters.includes(k) ? v.color : 'var(--border)'}`,
                    color: activeFilters.includes(k) ? v.color : 'var(--muted)',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--sans)',
                  }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div style={{ padding: '10px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
              ⟳ {status}
            </div>
          )}

          {/* Results list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
            {places.length === 0 && !loading && !status && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◎</div>
                Gib einen Ort ein um Sehenswürdigkeiten zu entdecken.
              </div>
            )}
            {places.map((p, i) => {
              const meta = CATEGORY_META[p.category] || CATEGORY_META.default
              return (
                <div key={p.id || i}
                  onClick={() => setActiveCard(activeCard === i ? null : i)}
                  style={{
                    padding: '12px 14px', borderRadius: 'var(--radius)', marginBottom: 6,
                    background: activeCard === i ? 'var(--bg3)' : 'var(--bg2)',
                    border: `1px solid ${activeCard === i ? 'var(--border2)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>{p.name}</div>
                    <span style={{
                      fontSize: 10, padding: '3px 7px', borderRadius: 12, flexShrink: 0,
                      background: meta.color + '22', color: meta.color,
                      fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
                    }}>{meta.label}</span>
                  </div>
                  {activeCard === i && (
                    <div style={{ marginTop: 8 }}>
                      {p.description
                        ? <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>{p.description}</p>
                        : <p style={{ fontSize: 13, color: 'var(--border2)', fontStyle: 'italic', marginBottom: 8 }}>Beschreibung wird geladen...</p>
                      }
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}&zoom=17`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: 'var(--accent)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          OSM →
                        </a>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: 'var(--accent)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          Google Maps →
                        </a>
                        {p.website && (
                          <a href={p.website} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: 'var(--accent)' }}
                            onClick={e => e.stopPropagation()}
                          >
                            Website →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            {places.length > 0 ? `${places.length} ORTE · ${cityName}` : 'OSM + CLAUDE AI'}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            places={places.filter(p => activeFilters.includes(p.category))}
            routePoints={routePoints}
            onMarkerClick={i => setActiveCard(i)}
          />
          {!mapCenter && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', zIndex: 1000,
            }}>
              <div style={{
                background: 'rgba(14,17,23,0.85)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '24px 32px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 28, color: 'var(--border2)', marginBottom: 12 }}>◎</div>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>Gib einen Ort ein um zu starten</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
