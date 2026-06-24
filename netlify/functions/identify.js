exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image, mediaType } = JSON.parse(event.body);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: `Analiza esta imagen e identifica el animal, pájaro, reptil, anfibio, insecto o animal marino que aparece.

Responde SOLO en este formato JSON exacto, sin texto adicional:
{
  "found": true,
  "commonName": "nombre común en español",
  "scientificName": "Nombre científico",
  "confidence": 87,
  "category": "Aves|Mamíferos|Reptiles|Anfibios|Marina|Insectos",
  "description": "Una frase breve sobre el animal",
  "funFact": "Una curiosidad interesante",
  "alternatives": [
    {"name": "Otra especie posible", "confidence": 12}
  ]
}

Si no hay ningún animal visible, responde:
{"found": false, "reason": "No se detecta ningún animal en la imagen"}`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, body: JSON.stringify({ error: 'Claude API error', detail: err }) };
    }

    const data = await response.json();
    const text = data.content[0].text;

    // Parse JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { statusCode: 200, body: JSON.stringify({ found: false, reason: 'No se pudo analizar la respuesta' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: jsonMatch[0]
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
