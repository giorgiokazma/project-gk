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
    const apiKey = (params.apiKey || "").trim();

    if (!apiKey || !apiKey.startsWith("RGAPI-")) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "API Key inválida o faltante (debe comenzar con RGAPI-)." })
      };
    }

    const riotFetch = async (url) => {
      const res = await fetch(url, {
        headers: { "X-Riot-Token": apiKey }
      });
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

    let totalSeconds = 0, riftSeconds = 0, riftMatches = 0, aramMatches = 0,
