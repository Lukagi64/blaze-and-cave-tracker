require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('./database');
const requireAuth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Debug: log all requests
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.path}`);
    next();
});

app.get('/api/home', (req, res) => {
    const players = db.getAllPlayers();
    const totalAdvancements = db.getTotalAdvancements();
    const recentAdvancements = db.getRecentAdvancements(5);
    const livePlayers = db.getLivePlayers();

    res.json({ players, totalAdvancements, recentAdvancements, livePlayers });
});

app.get('/api/advancements', (req, res) => {
    const { category, difficulty, player, completed, search } = req.query;
    let advancements = db.getAllAdvancements();

    if (category) advancements = advancements.filter(a => a.category === category);
    if (difficulty) advancements = advancements.filter(a => a.difficulty === difficulty);
    if (search) {
        const term = search.toLowerCase();
        advancements = advancements.filter(a =>
            a.name.toLowerCase().includes(term) ||
            a.technical_key.toLowerCase().includes(term)
        );
    }

    if (player) {
        const playerProgress = db.getPlayerProgress(player);
        const completedSet = new Set(playerProgress.filter(p => p.completed_at).map(p => p.technical_key));
        advancements = advancements.map(a => ({
            ...a,
            completed: completedSet.has(a.technical_key),
            completed_at: playerProgress.find(p => p.technical_key === a.technical_key)?.completed_at
        }));
        if (completed === 'true') advancements = advancements.filter(a => a.completed);
        if (completed === 'false') advancements = advancements.filter(a => !a.completed);
    }

    res.json(advancements);
});

app.get('/api/advancements/meta', (req, res) => {
    const categories = db.getCategories().map(c => c.category);
    const players = db.getAllPlayers();
    const difficulties = ['vert', 'bleu', 'violet', 'rouge', 'jaune', 'rose'];
    res.json({ categories, players, difficulties });
});

app.get('/api/players/:uuid/progress', (req, res) => {
    const progress = db.getPlayerProgress(req.params.uuid);
    const completed = progress.filter(p => p.completed_at).length;
    const total = progress.length;
    res.json({ progress, completed, total, percentage: total ? Math.round((completed / total) * 100) : 0 });
});

const advancementLimiter = rateLimit({
    windowMs: 60000,
    max: 60,
    message: { error: 'Too many requests, try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/advancements/:key(*)/complete', requireAuth, advancementLimiter, (req, res) => {
    const { player_uuid } = req.body;
    if (!player_uuid) return res.status(400).json({ error: 'player_uuid required' });
    if (!db.getPlayerByUuid(player_uuid)) return res.status(404).json({ error: 'Player not found' });
    if (!db.getAdvancementByKey(req.params.key)) return res.status(404).json({ error: 'Advancement not found' });

    db.completeAdvancement(player_uuid, req.params.key);
    res.json({ success: true });
});

app.delete('/api/advancements/:key(*)/complete', requireAuth, advancementLimiter, (req, res) => {
    const { player_uuid } = req.body;
    if (!player_uuid) return res.status(400).json({ error: 'player_uuid required' });
    db.uncompleteAdvancement(player_uuid, req.params.key);
    res.json({ success: true });
});

// Debug: clear ALL progression data (admin only)
app.delete('/api/debug/progression', requireAuth, (req, res) => {
    console.log('[DEBUG] DELETE /api/debug/progression hit');
    db.clearAllProgression();
    res.json({ success: true, message: 'All progression data cleared' });
});

app.get('/api/players', (req, res) => {
    res.json(db.getAllPlayers());
});

app.post('/api/players', (req, res) => {
    const { uuid, pseudo, twitch_channel } = req.body;
    if (!uuid || !pseudo) return res.status(400).json({ error: 'uuid and pseudo required' });
    try {
        db.createPlayer(uuid, pseudo, twitch_channel || '');
        res.json({ success: true });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Player already exists' });
        }
        throw e;
    }
});

app.get('/api/players/live', (req, res) => {
    res.json(db.getLivePlayers());
});

app.post('/api/players/:uuid/live', (req, res) => {
    const player = db.getPlayerByUuid(req.params.uuid);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { is_live } = req.body;
    if (typeof is_live !== 'boolean') return res.status(400).json({ error: 'is_live (boolean) required' });
    db.updatePlayerLiveStatus(req.params.uuid, { is_live });
    res.json({ success: true });
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});