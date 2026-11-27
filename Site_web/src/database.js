const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use in-memory database to avoid WAL/SHM issues on Windows Docker mounts
// For production, use a proper volume with correct permissions
const dbPath = process.env.DB_PATH || ':memory:';

const db = new Database(dbPath);

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

const seedPath = path.join(__dirname, '..', 'db', 'seed_advancements.sql');
if (fs.existsSync(seedPath)) {
    const seed = fs.readFileSync(seedPath, 'utf-8');
    db.exec(seed);
}

function getPlayerByUuid(uuid) {
    return db.prepare('SELECT * FROM Joueur WHERE uuid = ?').get(uuid);
}

function getPlayerByPseudo(pseudo) {
    return db.prepare('SELECT * FROM Joueur WHERE pseudo = ?').get(pseudo);
}

function getAllPlayers() {
    return db.prepare('SELECT * FROM Joueur ORDER BY pseudo').all();
}

function createPlayer(uuid, pseudo, twitch_channel) {
    return db.prepare('INSERT INTO Joueur (uuid, pseudo, twitch_channel) VALUES (?, ?, ?)').run(uuid, pseudo, twitch_channel);
}

function updatePlayerLiveStatus(uuid, liveData) {
    return db.prepare(`
        UPDATE Joueur SET
            is_live = ?,
            last_live_check = datetime('now')
        WHERE uuid = ?
    `).run(liveData.is_live ? 1 : 0, uuid);
}

function getLivePlayers() {
    return db.prepare('SELECT * FROM Joueur WHERE is_live = 1').all();
}

function getAllAdvancements() {
    return db.prepare('SELECT * FROM Advancement ORDER BY category, name').all();
}

function getAdvancementByKey(key) {
    return db.prepare('SELECT * FROM Advancement WHERE technical_key = ?').get(key);
}

function getAdvancementsByCategory(category) {
    return db.prepare('SELECT * FROM Advancement WHERE category = ? ORDER BY name').all(category);
}

function getCategories() {
    return db.prepare('SELECT DISTINCT category FROM Advancement ORDER BY category').all();
}

function getPlayerProgress(playerUuid) {
    return db.prepare(`
        SELECT a.*, p.completed_at
        FROM Advancement a
        LEFT JOIN Progression p ON a.technical_key = p.advancement_key AND p.player_uuid = ?
        ORDER BY a.category, a.name
    `).all(playerUuid);
}

function getPlayerCompletedCount(playerUuid) {
    return db.prepare('SELECT COUNT(*) as count FROM Progression WHERE player_uuid = ?').get(playerUuid).count;
}

function getTotalAdvancements() {
    return db.prepare('SELECT COUNT(*) as count FROM Advancement').get().count;
}

function getRecentAdvancements(limit = 10) {
    return db.prepare(`
        SELECT p.*, a.name, a.category, a.difficulty, a.icon, j.pseudo
        FROM Progression p
        JOIN Advancement a ON p.advancement_key = a.technical_key
        JOIN Joueur j ON p.player_uuid = j.uuid
        ORDER BY p.completed_at DESC
        LIMIT ?
    `).all(limit);
}

function completeAdvancement(playerUuid, advancementKey) {
    return db.prepare(`
        INSERT OR IGNORE INTO Progression (player_uuid, advancement_key, completed_at)
        VALUES (?, ?, datetime('now'))
    `).run(playerUuid, advancementKey);
}

function uncompleteAdvancement(playerUuid, advancementKey) {
    return db.prepare('DELETE FROM Progression WHERE player_uuid = ? AND advancement_key = ?').run(playerUuid, advancementKey);
}

function clearAllProgression() {
    return db.prepare('DELETE FROM Progression').run();
}

function isAdvancementCompleted(playerUuid, advancementKey) {
    return db.prepare('SELECT 1 FROM Progression WHERE player_uuid = ? AND advancement_key = ?').get(playerUuid, advancementKey);
}

module.exports = {
    db,
    getPlayerByUuid,
    getPlayerByPseudo,
    getAllPlayers,
    createPlayer,
    updatePlayerLiveStatus,
    getLivePlayers,
    getAllAdvancements,
    getAdvancementByKey,
    getAdvancementsByCategory,
    getCategories,
    getPlayerProgress,
    getPlayerCompletedCount,
    getTotalAdvancements,
    getRecentAdvancements,
    completeAdvancement,
    uncompleteAdvancement,
    isAdvancementCompleted,
    clearAllProgression
};