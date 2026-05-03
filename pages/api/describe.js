export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { places, city } = req.body
  if (!places || !places.length) return res.status(400).json({ error: 'No places' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

  try {
    const list = places.map((p, i) => `${i + 1}. ${p.name} (${p.category})`).join('\n')
    const prompt = `Du bist ein Reiseführer. Gib für jeden dieser Orte in/bei "${city}" eine kurze Beschreibung auf Deutsch (1-2 Sätze).

Antworte ausschließlich mit einem JSON-Array in diesem Format, ohne jeglichen anderen Text:
[{"index":1,"description":"Beschreibung hier"},{"index":2,"description":"Beschreibung hier"}]

Orte:
${list}`

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(25000),
      }
    )

    const data = await r.json()

    if (data.error) {
      console.error('Gemini API error:', JSON.stringify(data.error))
      return res.status(500).json({ error: data.error.message })
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) {
      console.error('No text in Gemini response:', JSON.stringify(data))
      return res.status(500).json({ error: 'Empty response from Gemini' })
    }

    // Strip any markdown fences just in case
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let descriptions
    try {
      descriptions = JSON.parse(clean)
    } catch (parseErr) {
      console.error('JSON parse failed. Raw:', raw)
      return res.status(500).json({ error: 'JSON parse error: ' + parseErr.message })
    }

    const map = {}
    descriptions.forEach(d => { if (d.index && d.description) map[d.index] = d.description })
    res.json({ descriptions: map })
  } catch (e) {
    console.error('describe handler error:', e.message)
    res.status(500).json({ error: e.message })
  }
}
