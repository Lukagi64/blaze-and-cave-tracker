import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './data/database.sqlite';
const SCHEMA_PATH = './db/schema.sql';
const SEED_PATH = './db/seed_advancements.sql';

// Création du dossier data s'il n'existe pas
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Activation des pragmas essentiels à chaque connexion
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialisation automatique au premier lancement
function initDatabase() {
  if (fs.existsSync(SCHEMA_PATH)) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
  }

  // Vérifier si la table Advancement est vide avant d'injecter le seed
  const row = db.prepare('SELECT COUNT(*) AS count FROM Advancement').get();
  if (row.count === 0 && fs.existsSync(SEED_PATH)) {
    console.log('Base vide détectée : import des advancements Blaze&Cave...');
    const seed = fs.readFileSync(SEED_PATH, 'utf-8');
    db.exec(seed);
    console.log('Import terminé avec succès.');
  }
}

initDatabase();

export default db;