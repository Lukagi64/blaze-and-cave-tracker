document.addEventListener('DOMContentLoaded', () => {
    initProgressRing();
    loadHomeData();
});

function initProgressRing() {
    const circle = document.querySelector('.progress-fill');
    if (!circle) return;
    circle.style.strokeDasharray = '339.3';
    circle.style.strokeDashoffset = '339.3';
}

function setProgress(percent) {
    const circle = document.querySelector('.progress-fill');
    const percentEl = document.getElementById('progressPercent');
    if (!circle || !percentEl) return;

    const offset = 339.3 * (1 - percent / 100);
    circle.style.strokeDashoffset = offset;
    percentEl.textContent = `${Math.round(percent)}%`;
}

async function loadHomeData() {
    try {
        const res = await fetch('/api/home');
        const data = await res.json();

        populatePlayerSelect(data.players);
        updateStats(data);
        renderRecentAdvancements(data.recentAdvancements);
        renderLivePlayers(data.livePlayers);

        const savedUuid = localStorage.getItem('selectedPlayerUuid');
        if (savedUuid) {
            const select = document.getElementById('playerSelect');
            if (select && [...select.options].some(o => o.value === savedUuid)) {
                select.value = savedUuid;
                loadProgressForPlayer(savedUuid);
            } else if (data.players.length > 0) {
                select.value = data.players[0].uuid;
                loadProgressForPlayer(data.players[0].uuid);
            }
        } else if (data.players.length > 0) {
            const select = document.getElementById('playerSelect');
            select.value = data.players[0].uuid;
            loadProgressForPlayer(data.players[0].uuid);
        }

        select.addEventListener('change', () => loadProgressForPlayer(select.value));

    } catch (err) {
        console.error('Failed to load home data:', err);
    }
}

function populatePlayerSelect(players) {
    const select = document.getElementById('playerSelect');
    if (!select) return;

    select.innerHTML = players.map(p => `<option value="${p.uuid}">${p.pseudo}</option>`).join('');
    if (players.length === 0) {
        select.innerHTML = '<option value="">Aucun joueur</option>';
    }
}

function updateStats(data) {
    const totalPlayersEl = document.getElementById('totalPlayers');
    const totalAdvancementsEl = document.getElementById('totalAdvancements');
    if (totalPlayersEl) totalPlayersEl.textContent = data.players.length;
    if (totalAdvancementsEl) totalAdvancementsEl.textContent = data.totalAdvancements;
}

function renderRecentAdvancements(list) {
    const container = document.getElementById('recentList');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<li class="recent-empty">Aucun advancement réalisé pour le moment</li>';
        return;
    }

    container.innerHTML = list.map(r => {
        const iconUrl = r.icon || `/icons/${r.category}.png`;
        const difficultyClass = `difficulty-${r.difficulty}`;
        return `
            <li class="recent-item">
                <span class="recent-icon" style="background-image: url('${iconUrl}')" onerror="this.style.backgroundImage=''"></span>
                <div class="recent-info">
                    <span class="recent-name">${escapeHtml(r.name)}</span>
                    <span class="recent-meta">${r.pseudo} • ${r.category} • ${new Date(r.completed_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <span class="recent-difficulty ${difficultyClass}">${r.difficulty}</span>
            </li>
        `;
    }).join('');
}

function renderLivePlayers(players) {
    const container = document.getElementById('streamContainer');
    if (!container) return;

    if (players.length === 0) {
        container.innerHTML = `
            <div class="stream-offline">
                <p>Omeega n'est pas en live pour le moment</p>
                <a href="https://twitch.tv/omeega" target="_blank" class="btn btn--outline">Voir la chaîne</a>
            </div>
        `;
        return;
    }

    container.innerHTML = players.map(p => `
        <div class="stream-live" data-uuid="${p.uuid}">
            ${p.live_thumbnail_url ? `<img class="stream-thumb" src="${p.live_thumbnail_url}" alt="${escapeHtml(p.live_title)}" onerror="this.style.display='none'">` : ''}
            <div class="stream-info">
                <h3>${escapeHtml(p.pseudo)}</h3>
                <p class="stream-title">${escapeHtml(p.live_title || 'En direct')}</p>
                <p class="stream-meta">${escapeHtml(p.live_game_name || 'Minecraft')} • ${p.live_viewer_count || 0} viewers</p>
            </div>
            <span class="live-badge">LIVE</span>
        </div>
    `).join('');
}

async function loadProgressForPlayer(uuid) {
    if (!uuid) return;
    localStorage.setItem('selectedPlayerUuid', uuid);

    try {
        const res = await fetch(`/api/players/${uuid}/progress`);
        const data = await res.json();

        setProgress(data.percentage);

        const fractionEl = document.getElementById('progressFraction');
        if (fractionEl) fractionEl.textContent = `${data.completed} / ${data.total}`;

        const completedEl = document.getElementById('totalCompleted');
        if (completedEl) completedEl.textContent = data.completed;

    } catch (err) {
        console.error('Failed to load progress:', err);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}