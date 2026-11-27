document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('advancementsGrid');
    const form = document.getElementById('filtersForm');
    const clearBtn = document.getElementById('clearFilters');
    const countEl = document.getElementById('advancementsCount');

    if (!grid) return;

    let allAdvancements = [];
    let currentPlayerUuid = null;
    let playerProgressCache = new Map();

    async function loadMeta() {
        try {
            const res = await fetch('/api/advancements/meta');
            const meta = await res.json();

            populateFilter('filterCategory', meta.categories, c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));
            populateFilter('filterDifficulty', meta.difficulties, d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }));
            populateFilter('filterPlayer', meta.players, p => ({ value: p.uuid, label: p.pseudo }), '<option value="">Tous (sans progression)</option>');

        } catch (err) {
            console.error('Failed to load meta:', err);
        }
    }

    function populateFilter(selectId, items, mapFn, defaultOption = '<option value="">Tous</option>') {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = defaultOption + items.map(mapFn).map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    }

    async function loadAllAdvancements() {
        try {
            const res = await fetch('/api/advancements');
            allAdvancements = await res.json();
            if (countEl) countEl.textContent = `${allAdvancements.length} advancements au total — Filtrez par catégorie, difficulté, joueur ou progression`;
            applyFilters();
        } catch (err) {
            console.error('Failed to load advancements:', err);
        }
    }

    function getIconUrl(icon) {
        if (!icon) return '';
        // Default to item texture, onerror will fallback to block texture
        if (icon.startsWith('minecraft:')) {
            const name = icon.replace('minecraft:', '');
            return `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.1/assets/minecraft/textures/item/${name}.png`;
        }
        return `/icons/${icon}.png`;
    }

    function getBlockIconUrl(icon) {
        if (!icon || !icon.startsWith('minecraft:')) return '';
        const name = icon.replace('minecraft:', '');
        return `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.1/assets/minecraft/textures/block/${name}.png`;
    }

    function getDisplayName(advancement) {
        return advancement.name_fr || advancement.name;
    }

    function renderAdvancements(list) {
        if (list.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <h2>Aucun advancement trouvé</h2>
                    <p>Essayez de modifier vos filtres</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = list.map(a => {
            const completed = a.completed === true;
            const completedAt = a.completed_at ? new Date(a.completed_at).toLocaleDateString('fr-FR') : null;
            const iconUrl = getIconUrl(a.icon);
            const blockIconUrl = getBlockIconUrl(a.icon);
            const displayName = getDisplayName(a);

            return `
                <article class="advancement-card ${completed ? 'completed' : ''}" data-key="${a.technical_key}">
                    ${completed ? '<span class="advancement-completed">✓</span>' : ''}
                    ${iconUrl ? `<div class="advancement-icon" style="background-image: url('${iconUrl}')" data-fallback="${blockIconUrl}" onerror="if(this.dataset.fallback){this.style.backgroundImage='url('+this.dataset.fallback+')';this.dataset.fallback='';}else{this.style.backgroundImage='';}"></div>` : ''}
                    <h3 class="advancement-name">${escapeHtml(displayName)}</h3>
                    <p class="advancement-category">${escapeHtml(a.category)}</p>
                    <span class="advancement-difficulty difficulty-${a.difficulty}">${a.difficulty}</span>
                    ${completedAt ? `<p class="advancement-completed-at" style="margin-top: 8px; font-size: 0.75rem; color: var(--color-text-muted);">Fini le ${completedAt}</p>` : ''}
                </article>
            `;
        }).join('');

        if (currentPlayerUuid) {
            attachClickHandlers();
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getFilters() {
        const formData = new FormData(form);
        return {
            search: formData.get('search') || '',
            category: formData.get('category') || '',
            difficulty: formData.get('difficulty') || '',
            player: formData.get('player') || '',
            completed: formData.get('completed') || ''
        };
    }

    async function loadPlayerProgress(uuid) {
        if (playerProgressCache.has(uuid)) return playerProgressCache.get(uuid);

        try {
            const res = await fetch(`/api/players/${uuid}/progress`);
            const data = await res.json();
            const progressMap = new Map();
            data.progress.forEach(p => {
                if (p.completed_at) progressMap.set(p.technical_key, p.completed_at);
            });
            playerProgressCache.set(uuid, progressMap);
            return progressMap;
        } catch (err) {
            console.error('Failed to load player progress:', err);
            return new Map();
        }
    }

    async function applyFilters() {
        const filters = getFilters();
        currentPlayerUuid = filters.player || null;

        let filtered = allAdvancements;

        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(term) ||
                a.technical_key.toLowerCase().includes(term)
            );
        }

        if (filters.category) {
            filtered = filtered.filter(a => a.category === filters.category);
        }

        if (filters.difficulty) {
            filtered = filtered.filter(a => a.difficulty === filters.difficulty);
        }

        if (currentPlayerUuid) {
            const progressMap = await loadPlayerProgress(currentPlayerUuid);
            filtered = filtered.map(a => ({
                ...a,
                completed: progressMap.has(a.technical_key),
                completed_at: progressMap.get(a.technical_key)
            }));

            if (filters.completed === 'true') {
                filtered = filtered.filter(a => a.completed);
            } else if (filters.completed === 'false') {
                filtered = filtered.filter(a => !a.completed);
            }
        }

        renderAdvancements(filtered);
    }

    function attachClickHandlers() {
        document.querySelectorAll('.advancement-card').forEach(card => {
            card.addEventListener('click', async () => {
                const key = card.dataset.key;
                const isCompleted = card.classList.contains('completed');

                try {
                    const method = isCompleted ? 'DELETE' : 'POST';
                    const res = await fetch(`/api/advancements/${encodeURIComponent(key)}/complete`, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ player_uuid: currentPlayerUuid })
                    });

                    if (res.ok) {
                        card.classList.toggle('completed');
                        const badge = card.querySelector('.advancement-completed');
                        if (isCompleted) {
                            badge?.remove();
                        } else {
                            card.insertAdjacentHTML('afterbegin', '<span class="advancement-completed">✓</span>');
                        }
                        playerProgressCache.delete(currentPlayerUuid);
                    }
                } catch (err) {
                    console.error('Failed to toggle advancement:', err);
                }
            });
        });
    }

    form.addEventListener('input', debounce(applyFilters, 300));
    form.addEventListener('change', applyFilters);

    clearBtn.addEventListener('click', () => {
        form.reset();
        currentPlayerUuid = null;
        applyFilters();
    });

    await loadMeta();
    await loadAllAdvancements();

    function debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }
});