exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const q = event.queryStringParameters?.q || '';
  if (!q || q.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Query too short' }) };
  }

  try {
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&rank=species,subspecies&per_page=20&locale=es&is_active=true&iconic_taxa=Animalia,Aves,Mammalia,Reptilia,Amphibia,Actinopterygii,Mollusca,Arachnida,Insecta`;
    
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'NaturaDex/1.0' }
    });

    if (!resp.ok) throw new Error('iNaturalist error ' + resp.status);
    
    const data = await resp.json();
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
