const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Missing query' })

  for (const mirror of MIRRORS) {
    try {
      const r = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Detourly/1.0 (travel explorer app)',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
      })
      if (!r.ok) continue
      const data = await r.json()
      return res.json(data)
    } catch (e) {
      console.warn(`Mirror ${mirror} failed:`, e.message)
      continue
    }
  }

  res.status(500).json({ error: 'All Overpass mirrors failed. Try again later.' })
}
