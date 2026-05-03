export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { places, city } = req.body
  if (!places || !places.length) return res.status(400).json({ error: 'No places' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

  try {
    const list = places.map((p, i) => `${i + 1}. ${p.name} (${p.category})`).join('\n')
    const prompt = `Du bist ein Reiseführer. Gib für jeden dieser Orte in/bei "${city}" eine kurze, informative Beschreibung auf Deutsch (max. 2 Sätze). Antworte NUR mit einem JSON-Array, absolut kein Markdown, keine Erklärung, nur reines JSON:
[{"index":1,"description":"..."},...]

Orte:
${list}`

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2000 },
        }),
        signal: AbortSignal.timeout(20000),
      }
    )

    const data = await r.json()
    if (data.error) throw new Error(data.error.message)

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const descriptions = JSON.parse(clean)
    const map = {}
    descriptions.forEach(d => { map[d.index] = d.description })
    res.json({ descriptions: map })
  } catch (e) {
    console.error('Gemini error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
