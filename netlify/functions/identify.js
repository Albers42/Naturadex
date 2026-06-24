exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image, mediaType } = JSON.parse(event.body);

    // Step 1: Claude identifies the animal
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
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
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `Identify the animal in this image as precisely as possible, including subspecies if identifiable. Respond ONLY in this exact JSON format with no additional text:
{"found":true,"commonNameES":"nombre común en español","commonNameEN":"common name in english","scientificName":"Genus species","confidence":87,"funFactES":"una curiosidad interesante en español"}
If no animal is visible: {"found":false,"reason":"explicación breve en español"}`
            }
          ]
        }]
      })
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      return { statusCode: 500, body: JSON.stringify({ error: 'Claude API error', detail: err }) };
    }

    const claudeData = await claudeResp.json();
    const text = claudeData.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { statusCode: 200, body: JSON.stringify({ found: false, reason: 'No se pudo analizar la imagen' }) };
    
    const claudeResult = JSON.parse(jsonMatch[0]);
    if (!claudeResult.found) {
      return { statusCode: 200, body: JSON.stringify(claudeResult) };
    }

    // Step 2: Search iNaturalist for full species data
    const sciName = encodeURIComponent(claudeResult.scientificName);
    const inatResp = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${sciName}&rank=species,subspecies&per_page=1&locale=es`,
      { headers: { 'Accept': 'application/json' } }
    );

    let inatData = null;
    if (inatResp.ok) {
      const inatJson = await inatResp.json();
      if (inatJson.results && inatJson.results.length > 0) {
        const taxon = inatJson.results[0];
        inatData = {
          id: taxon.id,
          scientificName: taxon.name,
          commonName: taxon.preferred_common_name || claudeResult.commonNameES,
          photo: taxon.default_photo?.medium_url || null,
          wikipediaUrl: taxon.wikipedia_url || null,
          rank: taxon.rank,
          ancestry: taxon.ancestry,
          iconic_taxon: taxon.iconic_taxon_name,
          conservationStatus: taxon.conservation_status?.status_name || null,
          observationsCount: taxon.observations_count || 0,
        };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        found: true,
        claude: claudeResult,
        inat: inatData,
        // Final merged result
        commonName: inatData?.commonName || claudeResult.commonNameES,
        scientificName: inatData?.scientificName || claudeResult.scientificName,
        confidence: claudeResult.confidence,
        funFact: claudeResult.funFactES,
        photo: inatData?.photo || null,
        conservationStatus: inatData?.conservationStatus || null,
        observationsCount: inatData?.observationsCount || 0,
        inatId: inatData?.id || null,
        iconicTaxon: inatData?.iconic_taxon || null,
      })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
