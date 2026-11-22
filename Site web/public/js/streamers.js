async function loadStreamers() {
  const container = document.getElementById('streamers-container');

  try {
    const res = await fetch('/api/streamers');
    if (!res.ok) throw new Error('Erreur réseau');
    const streamers = await res.json();

    if (streamers.length === 0) {
      container.innerHTML = '<p>Aucun streamer enregistré pour le moment.</p>';
      return;
    }

    container.innerHTML = streamers.map(s => {
      const mcAvatar = `https://mc-heads.net/avatar/${s.uuid}/32`;
      const twitchAvatar = s.twitch_avatar || mcAvatar;

      const previewHtml = s.is_live
        ? `
          <img src="${s.stream.thumbnail_url}" alt="Aperçu du live de ${s.twitch_display_name}">
          <span class="badge-status badge-live">En direct</span>
          <span class="viewer-count">${s.stream.viewer_count} spectateurs</span>
        `
        : `
          <span class="badge-status badge-offline">Hors-ligne</span>
          <span style="color: var(--text-muted); font-size: 0.85rem;">Stream déconnecté</span>
        `;

      const subtitle = s.is_live
        ? `${escapeHtml(s.stream.title)} (${escapeHtml(s.stream.game_name)})`
        : `Pseudo IG : ${escapeHtml(s.pseudo)}`;

      return `
        <article class="streamer-card ${s.is_live ? 'is-live' : ''}">
          <a href="${s.twitch_url}" target="_blank" rel="noopener noreferrer" class="stream-preview">
            ${previewHtml}
          </a>
          <div class="streamer-info">
            <div class="avatar-stack">
              <img src="${twitchAvatar}" alt="${escapeHtml(s.twitch_display_name)}" class="avatar-twitch">
              <img src="${mcAvatar}" alt="Skin ${escapeHtml(s.pseudo)}" class="avatar-mc" title="${escapeHtml(s.pseudo)}">
            </div>
            <div class="streamer-meta">
              <a href="${s.twitch_url}" target="_blank" rel="noopener noreferrer" class="streamer-name">
                ${escapeHtml(s.twitch_display_name)}
              </a>
              <p class="stream-title" title="${subtitle}">${subtitle}</p>
              <p class="adv-count">${s.total_completed} advancements complétés</p>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p>Impossible de charger le statut des streamers.</p>';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

loadStreamers();
// Rafraîchissement automatique toutes les 60 secondes (aligné sur le cache serveur)
setInterval(loadStreamers, 60000);