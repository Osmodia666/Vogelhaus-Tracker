export default async function handler(req, res) {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Missing query' })

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`
    const r = await fetch(url, { headers: { 'User-Agent': 'TravelExplorer/1.0' } })
    const data = await r.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
