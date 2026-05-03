export default async function handler(req, res) {
  const { name } = req.query
  if (!name) return res.status(400).json({ image: null })

  try {
    // Try Wikipedia pageimages first
    const r = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=pageimages&format=json&pithumbsize=500&origin=*`,
      { headers: { 'User-Agent': 'Detourly/1.0' }, signal: AbortSignal.timeout(5000) }
    )
    const data = await r.json()
    const pages = Object.values(data.query?.pages || {})
    const thumb = pages[0]?.thumbnail?.source
    if (thumb) return res.json({ image: thumb })

    // Fallback: search Wikipedia
    const r2 = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&origin=*&srlimit=1`,
      { headers: { 'User-Agent': 'Detourly/1.0' }, signal: AbortSignal.timeout(5000) }
    )
    const d2 = await r2.json()
    const hit = d2.query?.search?.[0]
    if (!hit) return res.json({ image: null })

    const r3 = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&pageids=${hit.pageid}&prop=pageimages&format=json&pithumbsize=500&origin=*`,
      { headers: { 'User-Agent': 'Detourly/1.0' }, signal: AbortSignal.timeout(5000) }
    )
    const d3 = await r3.json()
    const pages3 = Object.values(d3.query?.pages || {})
    return res.json({ image: pages3[0]?.thumbnail?.source || null })
  } catch (e) {
    return res.json({ image: null })
  }
}
