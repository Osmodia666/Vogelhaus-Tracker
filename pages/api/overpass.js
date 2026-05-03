export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Missing query' })

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`
    })
    const data = await r.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
