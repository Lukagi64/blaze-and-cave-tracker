# Blaze & Cave's Advancements Tracker

Projet personnel pour suivre les advancements du datapack **BlazeandCave's Advancements Pack** sur Minecraft.

## Structure du projet

```
Blaze and cave/
├── Script Python/                          # Scripts d'extraction de données
│   ├── extract_advancement.py             # Extrait les advancements → SQL
│   └── BlazeandCave's Advancements Pack 1.21.1/  # Datapack source (à conserver)
├── Site web/                              # Application web (Node.js + Express + SQLite)
│   ├── src/                               # Code serveur
│   │   ├── server.js                      # Point d'entrée Express
│   │   ├── database.js                    # Gestion SQLite
│   │   └── home.js                        # Routes principales
│   ├── public/                            # Frontend statique
│   │   ├── index.html                     # Page d'accueil
│   │   ├── advancements.html              # Page advancements
│   │   ├── streamers.html                 # Page streamers
│   │   ├── css/style.css
│   │   └── js/
│   ├── db/                                # Schéma et seed SQL
│   │   ├── schema.sql
│   │   └── seed_advancements.sql          # Généré par extract_advancement.py
│   ├── docker-compose.yml                 # Déploiement Docker
│   ├── Dockerfile
│   ├── package.json
│   └── .env                               # Variables d'environnement (ne pas commiter)
├── Plugin MC/                             # Futur plugin Minecraft (vide pour l'instant)
├── .gitignore
├── CLAUDE.md                              # Documentation pour Claude Code
└── README.md
```

## Prérequis

- **Node.js** 22+ (pour le site web)
- **Python** 3.10+ (pour les scripts d'extraction)
- **Docker** & **Docker Compose** (optionnel, pour déploiement)
- **Git**

## Installation rapide

### 1. Cloner le dépôt

```bash
git clone <votre-repo-url>
cd "Blaze and cave"
```

### 2. Configurer le site web

```bash
cd "Site web"
cp .env.example .env  # À créer si nécessaire
npm install
```

### 3. Générer la base de données des advancements

```bash
cd ../"Script Python"
python extract_advancement.py
# Cela génère Site web/db/seed_advancements.sql
```

### 4. Lancer le site web

**Option A : En local (développement)**
```bash
cd ../"Site web"
npm start
# Serveur sur http://localhost:3000
```

**Option B : Avec Docker**
```bash
cd ../"Site web"
docker-compose up -d
# Serveur sur http://localhost:3000
```

## Variables d'environnement (.env)

Créer un fichier `.env` dans `Site web/` avec :

```env
PORT=3000
DB_PATH=./data/database.sqlite
API_SECRET_TOKEN=votre_token_secret_ici
TWITCH_CLIENT_ID=votre_twitch_client_id
TWITCH_CLIENT_SECRET=votre_twitch_client_secret
```

## Scripts utiles

### Extraire les advancements du datapack

```bash
cd "Script Python"
python extract_advancement.py
```
Ce script parcourt le datapack source et génère `Site web/db/seed_advancements.sql` avec tous les advancements.

### Réinitialiser la base de données

```bash
cd "Site web"
rm data/database.sqlite*
npm start  # Recrée la DB avec le schema + seed au démarrage
```

## Développement sur deux machines

### Machine A (où vous avez fait les changements)

```bash
git add .
git commit -m "Vos changements"
git push origin main
```

### Machine B (pour récupérer les changements)

```bash
cd "Blaze and cave"
git pull origin main

# Si le site web a changé :
cd "Site web"
npm install  # Si package.json a changé

# Régénérer la seed si le datapack a changé :
cd ../"Script Python"
python extract_advancement.py
```

## Datapack source

Le dossier `Script Python/BlazeandCave's Advancements Pack 1.21.1/` contient le datapack Minecraft original. **Il est versionné** car c'est la source de vérité pour générer la base SQL.

Si vous mettez à jour le datapack :
1. Remplacez le contenu de ce dossier par la nouvelle version
2. Relancez `python extract_advancement.py`
3. Committez les changements (datapack + seed_advancements.sql)

## Architecture de la base de données

- **Joueur** : UUID, pseudo, chaîne Twitch
- **Advancement** : technical_key, nom, catégorie, difficulté (vert/bleu/violet/rouge/jaune/rose)
- **Progression** : Liaison joueur ↔ advancement avec date de completion

## API Endpoints (Site web)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/advancements` | Liste tous les advancements |
| GET | `/api/advancements/:category` | Advancements par catégorie |
| GET | `/api/players/:uuid/progress` | Progression d'un joueur |
| POST | `/api/players` | Créer/mettre à jour un joueur |
| POST | `/api/progress` | Marquer un advancement comme fait (auth requise) |

## Licence

Projet personnel - Datapack BlazeandCave's Advancements Pack © leurs auteurs respectifs.