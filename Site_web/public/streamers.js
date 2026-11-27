document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('streamersGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/players');
        const players = await res.json();

        if (players.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V19M17 12a3 3 0 0 1 0 6M17 12a3 3 0 0 0 0-6M9 12a3 3 0 0 1 0 6M9 12a3 3 0 0 0 0-6M23 9V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v4M12 3v4"/>
                    </svg>
                    <h2>Aucun participant</h2>
                    <p>Aucun streamer n'a été ajouté pour le moment</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = players.map(p => `
            <article class="streamer-card ${p.is_live ? 'live' : ''}" data-uuid="${p.uuid}">
                <a href="https://twitch.tv/${p.twitch_channel}" target="_blank" class="streamer-link-wrapper">
                    <div class="streamer-avatar">
                        <img src="https://mc-heads.net/avatar/${p.uuid}/80" alt="${escapeHtml(p.pseudo)}" onerror="this.src='https://mc-heads.net/avatar/steve/80'">
                        ${p.is_live ? '<span class="live-badge">LIVE</span>' : ''}
                    </div>
                    <div class="streamer-info">
                        <h2 class="streamer-name">${escapeHtml(p.pseudo)}</h2>
                        <span class="streamer-status ${p.is_live ? 'live' : 'offline'}">
                            ${p.is_live ? 'EN DIRECT' : `HORS LIGNE ${formatOfflineTime(p.last_live_check)}`}
                        </span>
                    </div>
                </a>
            </article>
        `).join('');

    } catch (err) {
        console.error('Failed to load streamers:', err);
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h2>Erreur de chargement</h2>
                <p>Impossible de récupérer les participants</p>
            </div>
        `;
    }
});

function formatOfflineTime(lastCheck) {
    if (!lastCheck) return '';
    const diff = Date.now() - new Date(lastCheck).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `depuis ${hours}h`;
    if (minutes > 0) return `depuis ${minutes}min`;
    return 'à l\'instant';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}