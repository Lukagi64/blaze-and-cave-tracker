import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'dotenv/config';
import db from './database.js';

const app = express();
const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_SECRET_TOKEN;

// Middlewares de base
app.use(helmet({ contentSecurityPolicy: false })); // Désactivé pour autoriser les avatars externes (mc-heads.net)
app.use(cors());
app.use(express.json());

// Sert les fichiers statiques du site web (HTML/CSS/JS) depuis /public
app.use(express.static('public'));

// Middleware d'authentification pour le plugin Minecraft
function verifyPluginToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!API_TOKEN || !authHeader || authHeader !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Non autorisé : Token invalide ou manquant.' });
  }
  next();
}

// Requêtes préparées (compilées une seule fois pour des performances maximales)
const upsertPlayer = db.prepare(`
  INSERT INTO Joueur (uuid, pseudo)
  VALUES (@uuid, @pseudo)
  ON CONFLICT(uuid) DO UPDATE SET pseudo = excluded.pseudo
`);

const insertProgression = db.prepare(`
  INSERT OR IGNORE INTO Progression (player_uuid, advancement_key, completed_at)
  VALUES (@uuid, @technical_key, @completed_at)
`);

// Transaction atomique : crée/met à jour le joueur ET enregistre l'advancement
const recordAdvancementTx = db.transaction((data) => {
  upsertPlayer.run({
    uuid: data.player_uuid,
    pseudo: data.player_name
  });

  const result = insertProgression.run({
    uuid: data.player_uuid,
    technical_key: data.technical_key,
    completed_at: data.completed_at
  });

  return result.changes > 0;
});

// === ROUTES API ===

// 1. Endpoint appelé par le plugin Java Paper
app.post('/api/advancements', verifyPluginToken, (req, res) => {
  const { player_uuid, player_name, technical_key, completed_at } = req.body;

  if (!player_uuid || !player_name || !technical_key || !completed_at) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  try {
    const inserted = recordAdvancementTx({
      player_uuid,
      player_name,
      technical_key,
      completed_at
    });

    return res.status(inserted ? 201 : 200).json({
      status: inserted ? 'created' : 'already_recorded',
      technical_key
    });
  } catch (err) {
    // Erreur fréquente : la technical_key envoyée n'existe pas dans la table Advancement
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(422).json({
        error: `Advancement inconnu en base : ${technical_key}`
      });
    }
    console.error('Erreur SQLite :', err);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// 2. Endpoint appelé par ta page Data pour récupérer tous les advancements + progressions
app.get('/api/progressions', (req, res) => {
  const rows = db.prepare(`
    SELECT 
      a.technical_key,
      a.name AS advancement_name,
      a.category,
      a.difficulty,
      j.uuid AS player_uuid,
      j.pseudo AS player_name,
      p.completed_at
    FROM Advancement a
    LEFT JOIN Progression p ON a.technical_key = p.advancement_key
    LEFT JOIN Joueur j ON p.player_uuid = j.uuid
    ORDER BY a.category ASC, a.name ASC
  `).all();

  res.json(rows);
});

// 3. Endpoint pour la page Streamers et le classement des joueurs
app.get('/api/players', (req, res) => {
  const players = db.prepare(`
    SELECT 
      j.uuid,
      j.pseudo,
      j.twitch_channel,
      COUNT(p.advancement_key) AS total_completed
    FROM Joueur j
    LEFT JOIN Progression p ON j.uuid = p.player_uuid
    GROUP BY j.uuid
    ORDER BY total_completed DESC
  `).all();

  res.json(players);
});

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Cache en mémoire pour le token OAuth Twitch et les résultats (évite le rate-limit)
let twitchTokenCache = {
  accessToken: null,
  expiresAt: 0
};

let streamersResponseCache = {
  data: null,
  expiresAt: 0
};

// Récupère ou renouvelle automatiquement l'App Access Token Twitch
async function getTwitchAppToken() {
  const now = Date.now();
  // Réutilise le token s'il est encore valide (avec 1 minute de marge)
  if (twitchTokenCache.accessToken && now < twitchTokenCache.expiresAt - 60000) {
    return twitchTokenCache.accessToken;
  }

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials'
  });

  const response = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`Erreur OAuth Twitch (${response.status})`);
  }

  const data = await response.json();
  twitchTokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000
  };

  return twitchTokenCache.accessToken;
}

// 4. Endpoint pour la page Streamers
app.get('/api/streamers', async (req, res) => {
  // 1. Récupérer uniquement les joueurs qui ont renseigné une chaîne Twitch
  const playersWithTwitch = db.prepare(`
    SELECT 
      j.uuid,
      j.pseudo,
      LOWER(TRIM(j.twitch_channel)) AS twitch_channel,
      COUNT(p.advancement_key) AS total_completed
    FROM Joueur j
    LEFT JOIN Progression p ON j.uuid = p.player_uuid
    WHERE j.twitch_channel IS NOT NULL AND TRIM(j.twitch_channel) != ''
    GROUP BY j.uuid
  `).all();

  if (playersWithTwitch.length === 0) {
    return res.json([]);
  }

  // Retourne le cache s'il a moins de 60 secondes (protège contre le spam de rafraîchissement F5)
  if (streamersResponseCache.data && Date.now() < streamersResponseCache.expiresAt) {
    return res.json(streamersResponseCache.data);
  }

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Identifiants API Twitch non configurés.' });
  }

  try {
    const token = await getTwitchAppToken();
    const headers = {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    };

    // Construction de la requête Helix (jusqu'à 100 logins par appel)
    const loginParams = playersWithTwitch
      .map(p => `user_login=${encodeURIComponent(p.twitch_channel)}`)
      .join('&');

    // Appels parallèles : infos de profil (avatars) + streams actuellement en direct
    const [usersRes, streamsRes] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/users?${loginParams}`, { headers }),
      fetch(`https://api.twitch.tv/helix/streams?${loginParams}`, { headers })
    ]);

    if (!usersRes.ok || !streamsRes.ok) {
      throw new Error('Erreur lors de la récupération des données Helix');
    }

    const [usersJson, streamsJson] = await Promise.all([
      usersRes.json(),
      streamsRes.json()
    ]);

    // Indexation rapide par login Twitch en minuscules
    const usersMap = new Map(usersJson.data.map(u => [u.login.toLowerCase(), u]));
    const streamsMap = new Map(streamsJson.data.map(s => [s.user_login.toLowerCase(), s]));

    // Fusion des données SQLite + Twitch
    const result = playersWithTwitch.map(player => {
      const login = player.twitch_channel;
      const twitchUser = usersMap.get(login);
      const liveStream = streamsMap.get(login);

      return {
        uuid: player.uuid,
        pseudo: player.pseudo,
        total_completed: player.total_completed,
        twitch_login: login,
        twitch_display_name: twitchUser?.display_name || login,
        twitch_avatar: twitchUser?.profile_image_url || null,
        twitch_url: `https://www.twitch.tv/${login}`,
        is_live: Boolean(liveStream),
        stream: liveStream ? {
          title: liveStream.title,
          game_name: liveStream.game_name,
          viewer_count: liveStream.viewer_count,
          started_at: liveStream.started_at,
          // Remplacement des dimensions dynamiques de la miniature Twitch
          thumbnail_url: liveStream.thumbnail_url
            .replace('{width}', '640')
            .replace('{height}', '360')
        } : null
      };
    });

    // Tri : les streamers en live en premier (par spectateurs), puis les hors-ligne par avancée
    result.sort((a, b) => {
      if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
      if (a.is_live && b.is_live) return b.stream.viewer_count - a.stream.viewer_count;
      return b.total_completed - a.total_completed;
    });

    // Mise en cache pendant 60 secondes
    streamersResponseCache = {
      data: result,
      expiresAt: Date.now() + 60_000
    };

    return res.json(result);
  } catch (err) {
    console.error('Erreur API Twitch :', err);
    return res.status(502).json({ error: 'Impossible de contacter Twitch pour le moment.' });
  }
});

app.listen(PORT, () => {
  console.log(`API opérationnelle sur le port ${PORT}`);
});