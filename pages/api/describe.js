export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { places, city } = req.body
  if (!places || !places.length) return res.status(400).json({ error: 'No places' })

  try {
    const list = places.map((p, i) => `${i + 1}. ${p.name} (${p.category})`).join('\n')

    const prompt = `Du bist ein Reiseführer. Gib für jeden dieser Orte in/bei "${city}" eine kurze, informative Beschreibung auf Deutsch (max. 2 Sätze). Antworte NUR mit einem JSON-Array, kein Markdown, keine Erklärung:
[{"index":1,"description":"..."},...]

Orte:
${list}`

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
        }),
      }
    )

    const data = await r.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const descriptions = JSON.parse(clean)
    const map = {}
    descriptions.forEach(d => { map[d.index] = d.description })
    res.json({ descriptions: map })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
