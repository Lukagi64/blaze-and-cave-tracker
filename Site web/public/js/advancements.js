let groupedAdvancements = [];

async function initAdvancements() {
  try {
    const res = await fetch('/api/progressions');
    const rawRows = await res.json();

    // Regroupement par technical_key (car plusieurs joueurs peuvent finir le même advancement)
    const map = new Map();
    const categories = new Set();
    const players = new Map();

    for (const row of rawRows) {
      categories.add(row.category);

      if (!map.has(row.technical_key)) {
        map.set(row.technical_key, {
          technical_key: row.technical_key,
          name: row.advancement_name,
          category: row.category,
          difficulty: row.difficulty,
          completions: []
        });
      }

      if (row.player_uuid) {
        players.set(row.player_uuid, row.player_name);
        map.get(row.technical_key).completions.push({
          uuid: row.player_uuid,
          name: row.player_name,
          completed_at: row.completed_at
        });
      }
    }

    // Tri chronologique des complétions pour chaque advancement
    groupedAdvancements = Array.from(map.values()).map(adv => {
      adv.completions.sort((a, b) => a.completed_at.localeCompare(b.completed_at));
      return adv;
    });

    populateSelect('filter-category', Array.from(categories).sort());
    populatePlayerSelect('filter-player', players);

    // Écouteurs sur tous les filtres
    ['filter-search', 'filter-category', 'filter-difficulty', 'filter-player', 'filter-status']
      .forEach(id => document.getElementById(id).addEventListener('input', renderTable));

    renderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('stats-summary').textContent = 'Erreur de chargement des données.';
  }
}

function populateSelect(id, values) {
  const select = document.getElementById(id);
  values.forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    select.appendChild(opt);
  });
}

function populatePlayerSelect(id, playersMap) {
  const select = document.getElementById(id);
  Array.from(playersMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([uuid, name]) => {
      const opt = document.createElement('option');
      opt.value = uuid;
      opt.textContent = name;
      select.appendChild(opt);
    });
}

function renderTable() {
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const category = document.getElementById('filter-category').value;
  const difficulty = document.getElementById('filter-difficulty').value;
  const playerUuid = document.getElementById('filter-player').value;
  const status = document.getElementById('filter-status').value;

  const filtered = groupedAdvancements.filter(adv => {
    if (search && !adv.name.toLowerCase().includes(search)) return false;
    if (category && adv.category !== category) return false;
    if (difficulty && adv.difficulty !== difficulty) return false;

    const hasCompleted = playerUuid
      ? adv.completions.some(c => c.uuid === playerUuid)
      : adv.completions.length > 0;

    if (status === 'completed' && !hasCompleted) return false;
    if (status === 'uncompleted' && hasCompleted) return false;

    return true;
  });

  // Mise à jour du compteur
  const completedCount = filtered.filter(a =>
    playerUuid ? a.completions.some(c => c.uuid === playerUuid) : a.completions.length > 0
  ).length;
  document.getElementById('stats-summary').textContent =
    `${filtered.length} advancements affichés (${completedCount} complétés)`;

  // Rendu limité aux 250 premiers résultats pour garder le DOM fluide (1100+ lignes sinon)
  const tbody = document.getElementById('advancements-tbody');
  tbody.innerHTML = filtered.slice(0, 250).map(adv => {
    const relevantCompletions = playerUuid
      ? adv.completions.filter(c => c.uuid === playerUuid)
      : adv.completions;

    let playersHtml = '<span class="status-uncompleted">Non complété</span>';
    let dateHtml = '—';

    if (relevantCompletions.length > 0) {
      playersHtml = relevantCompletions.map(c => `
        <div class="player-cell">
          <img src="https://mc-heads.net/avatar/${c.uuid}/24" alt="${c.name}" class="mc-head" loading="lazy">
          <span>${c.name}</span>
        </div>
      `).join('');

      dateHtml = formatDate(relevantCompletions[0].completed_at);
    }

    return `
      <tr>
        <td><strong>${adv.name}</strong></td>
        <td>${adv.category}</td>
        <td><span class="diff-badge diff-${adv.difficulty}">${adv.difficulty}</span></td>
        <td>${playersHtml}</td>
        <td>${dateHtml}</td>
      </tr>
    `;
  }).join('');
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

initAdvancements();