import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { getStatusKey } from '../components/MapView'

const MapView = dynamic(() => import('../components/MapView'), { ssr: false })
const BirdhouseForm = dynamic(() => import('../components/BirdhouseForm'), { ssr: false })

const FILTERS = [
  { key: 'alle', label: 'Alle' },
  { key: 'voll', label: 'Voll' },
  { key: 'defekt', label: 'Defekt' },
  { key: 'ok', label: 'OK' },
]

const STATUS_DOT = { ok: 'var(--green)', voll: 'var(--amber)', defekt: 'var(--red)' }
const STATUS_TEXT = { ok: 'Geleert', voll: 'Voll', defekt: 'Defekt' }

export default function Home() {
  const [birdhouses, setBirdhouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('alle')
  const [selectedId, setSelectedId] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const [formTarget, setFormTarget] = useState(null) // null = closed, {} = new, {...} = edit
  const [userPosition, setUserPosition] = useState(null)
  const [listOpen, setListOpen] = useState(true)

  const loadBirdhouses = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('birdhouses').select('*').order('created_at', { ascending: false })
    if (error) {
      setLoadError('Fehler beim Laden: ' + error.message)
    } else {
      setLoadError('')
      setBirdhouses(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    loadBirdhouses()
    const channel = supabase
      .channel('birdhouses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'birdhouses' }, () => loadBirdhouses())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadBirdhouses])

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        const pos2 = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserPosition(pos2)
        setMapCenter([pos2.lat, pos2.lng])
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => { locateMe() }, [locateMe])

  const filteredBirdhouses = useMemo(() => {
    if (filter === 'alle') return birdhouses
    return birdhouses.filter(b => getStatusKey(b) === filter)
  }, [birdhouses, filter])

  const counts = useMemo(() => {
    const c = { alle: birdhouses.length, voll: 0, defekt: 0, ok: 0 }
    birdhouses.forEach(b => { c[getStatusKey(b)]++ })
    return c
  }, [birdhouses])

  const selectBirdhouse = id => {
    setSelectedId(id)
    const b = birdhouses.find(x => x.id === id)
    if (b) setMapCenter([b.lat, b.lng])
  }

  const openNew = () => setFormTarget({})
  const openEdit = id => {
    const b = birdhouses.find(x => x.id === id)
    if (b) setFormTarget(b)
  }
  const closeForm = () => setFormTarget(null)
  const handleSaved = () => { closeForm(); loadBirdhouses() }
  const handleDeleted = () => { closeForm(); setSelectedId(null); loadBirdhouses() }

  return (
    <>
      <Head>
        <title>Vogelhaus-Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </Head>

      <div className="shell">
        <header className="header">
          <div className="brand">
            <div className="brand-kicker">Vogelhaus-Tracker</div>
            <div className="brand-title">Standorte & Zustand dokumentieren</div>
          </div>
          <button className="btn-add" onClick={openNew}>+ Neues Vogelhaus</button>
        </header>

        <div className="filters">
          {FILTERS.map(f => (
            <button key={f.key} className={`filter-chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.key !== 'alle' && <span className="dot" style={{ background: STATUS_DOT[f.key] }} />}
              {f.label}
              <span className="count">{counts[f.key] ?? 0}</span>
            </button>
          ))}
          <button className="filter-chip locate" onClick={locateMe}>Meine Position</button>
        </div>

        {!isSupabaseConfigured && (
          <div className="banner">
            Supabase ist noch nicht konfiguriert. Bitte <code>NEXT_PUBLIC_SUPABASE_URL</code> und{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code> eintragen (siehe README.md).
          </div>
        )}
        {loadError && <div className="banner error">{loadError}</div>}

        <main className="main">
          <div className={`list-panel ${listOpen ? 'open' : ''}`}>
            <button className="list-toggle" onClick={() => setListOpen(o => !o)}>
              {listOpen ? 'Liste ausblenden ▾' : `Liste anzeigen (${filteredBirdhouses.length}) ▴`}
            </button>
            <div className="list-scroll">
              {loading && <div className="empty">Lädt…</div>}
              {!loading && filteredBirdhouses.length === 0 && (
                <div className="empty">Noch keine Vogelhäuser erfasst. Tippe auf „Neues Vogelhaus“.</div>
              )}
              {filteredBirdhouses.map(b => {
                const key = getStatusKey(b)
                const active = b.id === selectedId
                return (
                  <div
                    key={b.id}
                    className={`card ${active ? 'active' : ''}`}
                    onClick={() => selectBirdhouse(b.id)}
                    onDoubleClick={() => openEdit(b.id)}
                  >
                    <span className="dot" style={{ background: STATUS_DOT[key] }} />
                    <div className="card-body">
                      <div className="card-title">{b.name || 'Vogelhaus'}</div>
                      <div className="card-sub">
                        {STATUS_TEXT[key]}
                        {b.defect_note ? ` · ${b.defect_note}` : ''}
                      </div>
                    </div>
                    <button className="card-edit" onClick={e => { e.stopPropagation(); openEdit(b.id) }}>Bearbeiten</button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="map-panel">
            <MapView
              birdhouses={filteredBirdhouses}
              onMarkerClick={openEdit}
              center={mapCenter}
              zoom={mapCenter ? 16 : undefined}
              selectedId={selectedId}
              userPosition={userPosition}
            />
            <button className="fab" onClick={openNew} aria-label="Neues Vogelhaus hinzufügen">+</button>
          </div>
        </main>
      </div>

      {formTarget !== null && (
        <BirdhouseForm
          initial={formTarget.id ? formTarget : null}
          onClose={closeForm}
          onSaved={handleSaved}
          onDelete={handleDeleted}
        />
      )}

      <style jsx>{`
        .shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 12px;
        }
        .brand-kicker { font-family: var(--mono); font-size: 10px; color: var(--accent); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 3px; }
        .brand-title { font-size: 16px; font-weight: 600; }
        .btn-add {
          background: var(--accent); color: #fff; border: none; border-radius: var(--radius);
          padding: 10px 14px; font-size: 13px; font-weight: 600; flex-shrink: 0; white-space: nowrap;
        }
        .filters {
          display: flex; gap: 8px; padding: 10px 18px; overflow-x: auto; border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .filter-chip {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px;
          background: var(--bg2); border: 1px solid var(--border); color: var(--muted); font-size: 12px; white-space: nowrap; flex-shrink: 0;
        }
        .filter-chip.active { background: var(--bg3); border-color: var(--border2); color: var(--text); }
        .filter-chip.locate { margin-left: auto; color: var(--accent); border-color: var(--accent); }
        .filter-chip .dot { width: 8px; height: 8px; border-radius: 50%; }
        .filter-chip .count { font-family: var(--mono); font-size: 10px; opacity: 0.7; }
        .banner {
          padding: 8px 18px; background: rgba(79,156,249,0.1); border-bottom: 1px solid var(--border);
          font-size: 12px; color: var(--accent); flex-shrink: 0;
        }
        .banner.error { background: rgba(255,95,86,0.1); color: var(--red); }
        .banner code { font-family: var(--mono); font-size: 11px; }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        .map-panel { flex: 1; position: relative; min-height: 240px; }
        .list-panel { display: flex; flex-direction: column; background: var(--bg); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .list-toggle {
          display: block; width: 100%; text-align: left; padding: 8px 18px; background: var(--bg2);
          border: none; color: var(--muted); font-size: 12px; font-family: var(--mono);
        }
        .list-scroll { max-height: 0; overflow-y: auto; transition: max-height 0.2s ease; }
        .list-panel.open .list-scroll { max-height: 34vh; }
        .empty { padding: 20px 18px; color: var(--muted); font-size: 13px; text-align: center; }
        .card {
          display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-bottom: 1px solid var(--border);
        }
        .card.active { background: var(--bg2); }
        .card .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .card-body { flex: 1; min-width: 0; }
        .card-title { font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .card-sub { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .card-edit {
          background: none; border: 1px solid var(--border2); color: var(--muted); border-radius: var(--radius);
          padding: 5px 9px; font-size: 11px; flex-shrink: 0;
        }
        .fab {
          position: absolute; right: 16px; bottom: 20px; width: 52px; height: 52px; border-radius: 50%;
          background: var(--accent); color: #fff; border: none; font-size: 26px; line-height: 1;
          box-shadow: 0 4px 16px rgba(0,0,0,0.35); z-index: 900;
        }

        @media (min-width: 900px) {
          .main { flex-direction: row; }
          .list-panel { width: 360px; border-bottom: none; border-right: 1px solid var(--border); }
          .list-toggle { display: none; }
          .list-panel .list-scroll { max-height: none; overflow-y: auto; flex: 1; }
          .fab { display: none; }
        }
      `}</style>
    </>
  )
}
