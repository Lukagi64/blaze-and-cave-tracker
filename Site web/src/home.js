async function loadHomeDashboard() {
  try {
    // Chargement parallèle des progressions et du classement joueurs
    const [progRes, playersRes] = await Promise.all([
      fetch('/api/progressions'),
      fetch('/api/players')
    ]);

    if (!progRes.ok || !playersRes.ok) {
      throw new Error('Erreur lors de la récupération des données');
    }

    const progressions = await progRes.json();
    const players = await playersRes.json();

    renderGlobalProgress(progressions);
    renderPodium(players);
    renderRecentCompletions(progressions);
  } catch (err) {
    console.error(err);
    document.getElementById('global-progress-text').textContent =
      'Impossible de charger les statistiques du serveur.';
  }
}

// 1. Barre de progression globale (advancements uniques débloqués par au moins 1 joueur)
function renderGlobalProgress(rows) {
  const allKeys = new Set();
  const completedKeys = new Set();

  for (const row of rows) {
    allKeys.add(row.technical_key);
    if (row.player_uuid) {
      completedKeys.add(row.technical_key);
    }
  }

  const total = allKeys.size;
  const completed = completedKeys.size;
  const percent = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

  document.getElementById('global-progress-text').textContent =
    `${completed} / ${total} advancements uniques débloqués sur le serveur`;
  document.getElementById('global-progress-percent').textContent = `${percent} %`;
  document.getElementById('global-progress-bar').style.width = `${percent}%`;
}

// 2. Podium des meilleurs joueurs
function renderPodium(players) {
  const list = document.getElementById('podium-list');

  if (players.length === 0) {
    list.innerHTML = '<li style="color: var(--text-muted);">Aucun joueur enregistré.</li>';
    return;
  }

  // On affiche le top 5 (dont le podium 1, 2, 3 mis en valeur)
  list.innerHTML = players.slice(0, 5).map((player, index) => {
    const rank = index + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : '';

    return `
      <li class="podium-item">
        <div class="podium-left">
          <span class="rank-badge ${rankClass}">#${rank}</span>
          <img src="https://mc-heads.net/avatar/${player.uuid}/28" alt="${escapeHtml(player.pseudo)}" class="mc-head">
          <strong>${escapeHtml(player.pseudo)}</strong>
        </div>
        <span style="color: var(--accent); font-weight: 600;">
          ${player.total_completed} adv.
        </span>
      </li>
    `;
  }).join('');
}

// 3. Les 10 derniers advancements débloqués chronologiquement
function renderRecentCompletions(rows) {
  const list = document.getElementById('recent-list');

  // Ne garder que les lignes ayant une date de complétion et trier du plus récent au plus ancien
  const completedEvents = rows
    .filter(r => r.player_uuid && r.completed_at)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
    .slice(0, 10);

  if (completedEvents.length === 0) {
    list.innerHTML = '<li style="color: var(--text-muted);">Aucun advancement débloqué pour le moment.</li>';
    return;
  }

  list.innerHTML = completedEvents.map(ev => `
    <li class="recent-item">
      <div class="recent-info">
        <img src="https://mc-heads.net/avatar/${ev.player_uuid}/28" alt="${escapeHtml(ev.player_name)}" class="mc-head">
        <div class="recent-text">
          <span class="recent-adv-name">${escapeHtml(ev.advancement_name)}</span>
          <span class="recent-meta">
            Par <strong>${escapeHtml(ev.player_name)}</strong> • ${formatRelativeDate(ev.completed_at)}
          </span>
        </div>
      </div>
      <span class="diff-badge diff-${ev.difficulty}">${ev.difficulty}</span>
    </li>
  `).join('');
}

function formatRelativeDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

loadHomeDashboard();