import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured, PHOTOS_BUCKET } from '../lib/supabaseClient'

export default function BirdhouseForm({ initial, onClose, onSaved, onDelete }) {
  const isEdit = Boolean(initial?.id)

  const [name, setName] = useState(initial?.name || '')
  const [status, setStatus] = useState(initial?.status || 'leer')
  const [hasDefect, setHasDefect] = useState(initial?.has_defect || false)
  const [defectNote, setDefectNote] = useState(initial?.defect_note || '')
  const [note, setNote] = useState(initial?.note || '')
  const [lat, setLat] = useState(initial?.lat ?? null)
  const [lng, setLng] = useState(initial?.lng ?? null)
  const [accuracy, setAccuracy] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url || null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('GPS wird von diesem Browser nicht unterstützt.')
      return
    }
    setLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setAccuracy(pos.coords.accuracy)
        setLocating(false)
      },
      err => {
        setLocationError(
          err.code === 1
            ? 'Standortzugriff wurde verweigert. Bitte in den Browser-/App-Einstellungen erlauben.'
            : 'Standort konnte nicht ermittelt werden: ' + err.message
        )
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  useEffect(() => {
    if (!isEdit) captureLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePhotoChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('Supabase ist nicht konfiguriert. Ohne Datenbank-Anbindung kann nichts gespeichert werden (siehe README.md, Abschnitt „Setup“).')
      return
    }
    if (lat == null || lng == null) {
      setError('Bitte zuerst den Standort erfassen.')
      return
    }
    setSaving(true)
    setError('')
    try {
      let photoUrl = initial?.photo_url || null
      if (photoFile) {
        const ext = (photoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from(PHOTOS_BUCKET)
          .upload(path, photoFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        const { data: publicUrlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
        photoUrl = publicUrlData.publicUrl
      }

      const payload = {
        name: name.trim() || null,
        lat,
        lng,
        status,
        has_defect: hasDefect,
        defect_note: hasDefect ? (defectNote.trim() || null) : null,
        note: note.trim() || null,
        photo_url: photoUrl,
        checked_at: new Date().toISOString(),
      }

      if (isEdit) {
        const { error: updateError } = await supabase.from('birdhouses').update(payload).eq('id', initial.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('birdhouses').insert(payload)
        if (insertError) throw insertError
      }
      onSaved()
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase ist nicht konfiguriert. Ohne Datenbank-Anbindung kann nichts gelöscht werden.')
      return
    }
    if (!confirm('Dieses Vogelhaus wirklich löschen?')) return
    setDeleting(true)
    setError('')
    try {
      const { error: deleteError } = await supabase.from('birdhouses').delete().eq('id', initial.id)
      if (deleteError) throw deleteError
      onDelete()
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message)
    }
    setDeleting(false)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <div className="sheet-title">{isEdit ? 'Vogelhaus bearbeiten' : 'Neues Vogelhaus'}</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-body">
          {!isSupabaseConfigured && (
            <div className="config-banner">
              Supabase ist nicht konfiguriert — Speichern ist erst möglich, wenn
              <code> NEXT_PUBLIC_SUPABASE_URL</code> und <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
              gesetzt sind (siehe README.md).
            </div>
          )}
          <div className="field">
            <label>Standort / Bezeichnung</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Eiche am Waldweg" />
          </div>

          <div className="field">
            <label>GPS-Standort</label>
            <div className="gps-row">
              <div className="gps-value">
                {lat != null && lng != null
                  ? `${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracy ? ` (±${Math.round(accuracy)} m)` : ''}`
                  : 'Noch kein Standort erfasst'}
              </div>
              <button type="button" className="btn-secondary" onClick={captureLocation} disabled={locating}>
                {locating ? 'Ermittle…' : (lat != null ? 'Neu erfassen' : 'Standort erfassen')}
              </button>
            </div>
            {locationError && <div className="error-text">{locationError}</div>}
          </div>

          <div className="field">
            <label>Füllstand</label>
            <div className="toggle-row">
              <button type="button" className={`toggle ${status === 'leer' ? 'toggle-active ok' : ''}`} onClick={() => setStatus('leer')}>
                Geleert
              </button>
              <button type="button" className={`toggle ${status === 'voll' ? 'toggle-active voll' : ''}`} onClick={() => setStatus('voll')}>
                Voll
              </button>
            </div>
          </div>

          <div className="field">
            <label className="checkbox-label">
              <input type="checkbox" checked={hasDefect} onChange={e => setHasDefect(e.target.checked)} />
              Defekt vorhanden (muss behoben werden)
            </label>
            {hasDefect && (
              <textarea
                value={defectNote}
                onChange={e => setDefectNote(e.target.value)}
                placeholder="Was ist defekt? z.B. Dach lose, Halterung gebrochen…"
                rows={2}
              />
            )}
          </div>

          <div className="field">
            <label>Notiz (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Weitere Beobachtungen…" rows={2} />
          </div>

          <div className="field">
            <label>Foto (optional)</label>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} />
            {photoPreview && (
              <img src={photoPreview} alt="Vorschau" className="photo-preview" />
            )}
          </div>

          {error && <div className="error-text">{error}</div>}

          <div className="sheet-actions">
            {isEdit && (
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting || saving}>
                {deleting ? 'Löscht…' : 'Löschen'}
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={saving || deleting}>
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 2000;
        }
        .sheet {
          background: var(--bg);
          width: 100%;
          max-width: 480px;
          max-height: 92vh;
          border-radius: 16px 16px 0 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid var(--border);
          border-bottom: none;
        }
        @media (min-width: 640px) {
          .overlay { align-items: center; }
          .sheet { border-radius: var(--radius-lg); border-bottom: 1px solid var(--border); max-height: 88vh; }
        }
        .sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .sheet-title { font-size: 16px; font-weight: 600; }
        .icon-btn {
          background: none; border: none; color: var(--muted); font-size: 18px; line-height: 1; padding: 4px;
        }
        .sheet-body { overflow-y: auto; padding: 16px 18px 20px; display: flex; flex-direction: column; gap: 16px; }
        .config-banner {
          background: rgba(255,95,86,0.1); border: 1px solid var(--red); color: var(--red);
          border-radius: var(--radius); padding: 10px 12px; font-size: 12px; line-height: 1.5;
        }
        .config-banner code { font-family: var(--mono); font-size: 11px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 12px; color: var(--muted); font-weight: 500; }
        .field textarea {
          background: var(--bg2); border: 1px solid var(--border); color: var(--text);
          font-family: var(--sans); font-size: 14px; padding: 10px 14px; border-radius: var(--radius);
          outline: none; resize: vertical; width: 100%;
        }
        .gps-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .gps-value { font-family: var(--mono); font-size: 12px; color: var(--text); flex: 1; min-width: 160px; }
        .error-text { color: var(--red); font-size: 12px; }
        .toggle-row { display: flex; gap: 8px; }
        .toggle {
          flex: 1; padding: 10px; border-radius: var(--radius); border: 1px solid var(--border);
          background: var(--bg2); color: var(--muted); font-size: 14px; font-weight: 500;
        }
        .toggle-active.ok { background: rgba(62,207,142,0.15); border-color: var(--green); color: var(--green); }
        .toggle-active.voll { background: rgba(245,166,35,0.15); border-color: var(--amber); color: var(--amber); }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text); cursor: pointer; }
        .checkbox-label input { width: auto; }
        .photo-preview { width: 100%; max-height: 200px; object-fit: cover; border-radius: var(--radius); margin-top: 8px; }
        .sheet-actions { display: flex; gap: 10px; margin-top: 4px; }
        .btn-primary, .btn-secondary, .btn-danger {
          border-radius: var(--radius); font-size: 14px; font-weight: 600; padding: 12px 18px; border: none; flex-shrink: 0;
        }
        .btn-primary { background: var(--accent); color: #fff; flex: 1; }
        .btn-primary:disabled { opacity: 0.6; }
        .btn-secondary { background: var(--bg3); color: var(--text); border: 1px solid var(--border2); }
        .btn-danger { background: transparent; color: var(--red); border: 1px solid var(--red); }
      `}</style>
    </div>
  )
}
