exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    const params = event.queryStringParameters || {};
    const gameName = (params.gameName || "GiorgioKazma").trim();
    const tagLine = (params.tagLine || "GK26").trim().replace("#", "");
    const region = (params.region || "la2").trim();
    const apikey = (params.apiKey || "").trim();

    if (!apikey || !apikey.startsWith("RGAPI-")) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "API Key inválida o faltante (debe comenzar con RGAPI-)." })
      };
    }

    const riotFetch = async (url) => {
      const res = await fetch(url, { headers: { "X-Riot-Token": apikey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.status?.message || `Error HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return data;
    };

    const accountUrl = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const account = await riotFetch(accountUrl);
    const puuid = account.puuid;

    const [summoner, masteries, matchIds] = await Promise.all([
      riotFetch(`https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`),
      riotFetch(`https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`),
      riotFetch(`https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=8`)
    ]);

    let totalSeconds = 0, riftSeconds = 0, riftMatches = 0, aramMatches = 0, pentakills = 0;
    const sampleIds = Array.isArray(matchIds) ? matchIds.slice(0, 6) : [];

    const matches = await Promise.all(
      sampleIds.map((id) => riotFetch(`https://americas.api.riotgames.com/lol/match/v5/matches/${id}`).catch(() => null))
    );

    matches.forEach((m) => {
      if (!m || !m.info) return;
      const dur = m.info.gameDuration || 0;
      totalSeconds += dur;
      if (m.info.queueId === 450) { aramMatches++; }
      else { riftMatches++; riftSeconds += dur; }

      const participant = (m.info.participants || []).find((p) => p.puuid === puuid);
      if (participant && participant.pentakills) { pentakills += participant.pentakills; }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        account,
        summoner,
        masteries,
        stats: {
          matchesAnalyzed: matches.filter(Boolean).length,
          totalHours: (totalSeconds / 3600).toFixed(1),
          riftHours: (riftSeconds / 3600).toFixed(1),
          riftMatches,
          aramMatches,
          pentakills
        }
      })
    };

  } catch (err) {
    return {
      statusCode: err.status || 500,
      headers,
      body: JSON.stringify({ error: err.message || "Error conectando con Riot Games API" })
    };
  }
};
