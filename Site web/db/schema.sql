-- Activation des clés étrangères et optimisation des accès concurrents
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Table Joueur
CREATE TABLE IF NOT EXISTS Joueur (
    uuid TEXT PRIMARY KEY NOT NULL,                  
    pseudo TEXT NOT NULL,                            
    twitch_channel TEXT DEFAULT NULL,               
    created_at TEXT DEFAULT (datetime('now'))       
);

-- 2. Table Advancement 
CREATE TABLE IF NOT EXISTS Advancement (
    technical_key TEXT PRIMARY KEY NOT NULL,        
    name TEXT NOT NULL,                              
    category TEXT NOT NULL,                          
    difficulty TEXT NOT NULL CHECK (                 
        difficulty IN ('vert', 'bleu', 'violet')
    )
);

-- 3. Table de liaison Progression
CREATE TABLE IF NOT EXISTS Progression (
    player_uuid TEXT NOT NULL,
    advancement_key TEXT NOT NULL,
    completed_at TEXT NOT NULL,                      
    
    PRIMARY KEY (player_uuid, advancement_key),
    FOREIGN KEY (player_uuid) REFERENCES Joueur(uuid) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    FOREIGN KEY (advancement_key) REFERENCES Advancement(technical_key) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- === INDEX POUR ACCÉLÉRER LES REQUÊTES DU SITE WEB ===

CREATE INDEX IF NOT EXISTS idx_advancement_category ON Advancement(category);
CREATE INDEX IF NOT EXISTS idx_advancement_difficulty ON Advancement(difficulty);

CREATE INDEX IF NOT EXISTS idx_progression_completed_at ON Progression(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_progression_player ON Progression(player_uuid);