-- Database schema for Blaze & Cave's Advancements Tracker

CREATE TABLE IF NOT EXISTS Joueur (
    uuid TEXT PRIMARY KEY,
    pseudo TEXT NOT NULL UNIQUE,
    twitch_channel TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_live BOOLEAN DEFAULT 0,
    last_live_check DATETIME
);

CREATE TABLE IF NOT EXISTS Advancement (
    technical_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_fr TEXT,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('vert', 'bleu', 'violet', 'rouge', 'jaune', 'rose')),
    description TEXT,
    icon TEXT
);

CREATE TABLE IF NOT EXISTS Progression (
    player_uuid TEXT NOT NULL,
    advancement_key TEXT NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_uuid, advancement_key),
    FOREIGN KEY (player_uuid) REFERENCES Joueur(uuid) ON DELETE CASCADE,
    FOREIGN KEY (advancement_key) REFERENCES Advancement(technical_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_advancement_category ON Advancement(category);
CREATE INDEX IF NOT EXISTS idx_advancement_difficulty ON Advancement(difficulty);
CREATE INDEX IF NOT EXISTS idx_progression_completed_at ON Progression(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_progression_player ON Progression(player_uuid);
CREATE INDEX IF NOT EXISTS idx_joueur_live ON Joueur(is_live);