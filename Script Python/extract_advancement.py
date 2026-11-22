import json
from pathlib import Path

# === CONFIGURATION ===
# Chemin vers le dossier contenant les advancements du datapack décompressé
# Exemple : "./BlazeandCaves_Advancements_Pack/data/blazeandcave/advancement"
DATAPACK_ADVANCEMENTS_DIR = Path("./BlazeandCave's Advancements Pack 1.21.1/data/blazeandcave/advancement")
NAMESPACE = "blazeandcave"
OUTPUT_SQL_FILE = Path("./seed_advancements.sql")

# Correspondance entre le "frame" Minecraft et ta difficulté
FRAME_TO_DIFFICULTY = {
    "task": "vert",
    "goal": "bleu",
    "challenge": "violet",
    "super challenge": "rouge",
    "milestone": "jaune",
    "secret":"rose"
}

def extract_text(title_field) -> str:
    """
    Gère les différents formats de titre dans les JSON Minecraft
    (chaîne simple, dictionnaire avec 'translate' ou 'text', ou liste de composants).
    """
    if isinstance(title_field, str):
        return title_field
    if isinstance(title_field, dict):
        return title_field.get("text") or title_field.get("translate") or "Inconnu"
    if isinstance(title_field, list):
        return "".join(extract_text(item) for item in title_field)
    return "Inconnu"

def escape_sql(value: str) -> str:
    """Échappe les apostrophes pour éviter de casser la requête SQL."""
    return value.replace("'", "''").strip()

def main():
    if not DATAPACK_ADVANCEMENTS_DIR.exists():
        print(f"Erreur : Le dossier '{DATAPACK_ADVANCEMENTS_DIR}' est introuvable.")
        return

    sql_statements = [
        "-- Fichier généré automatiquement depuis le datapack Blaze&Cave's Advancement",
        "BEGIN TRANSACTION;\n"
    ]

    count = 0

    # Parcours récursif de tous les fichiers .json
    for json_file in sorted(DATAPACK_ADVANCEMENTS_DIR.rglob("*.json")):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"Fichier ignoré (erreur de lecture) : {json_file} -> {e}")
            continue

        # Ignorer les advancements techniques invisibles (sans bloc 'display')
        display = data.get("display")
        if not display:
            continue

        # Ignorer les icônes d'onglets (root.json) si tu ne veux pas les compter
        if json_file.stem == "root":
            continue

        # Construction de la technical_key (ex: blazeandcave:nether/into_the_fire)
        relative_path = json_file.relative_to(DATAPACK_ADVANCEMENTS_DIR)
        path_without_ext = relative_path.with_suffix("").as_posix()
        technical_key = f"{NAMESPACE}:{path_without_ext}"

        # La catégorie est le premier sous-dossier (ex: "nether", "mining")
        category = relative_path.parts[0] if len(relative_path.parts) > 1 else "general"

        # Récupération du nom et de la difficulté
        raw_title = display.get("title", json_file.stem)
        name = extract_text(raw_title)

        frame = display.get("frame", "task")
        difficulty = FRAME_TO_DIFFICULTY.get(frame, "vert")

        # Génération de la requête INSERT
        sql = (
            f"INSERT OR IGNORE INTO Advancement (technical_key, name, category, difficulty) "
            f"VALUES ('{escape_sql(technical_key)}', '{escape_sql(name)}', "
            f"'{escape_sql(category)}', '{escape_sql(difficulty)}');"
        )
        sql_statements.append(sql)
        count += 1

    sql_statements.append("\nCOMMIT;")

    with open(OUTPUT_SQL_FILE, "w", encoding="utf-8") as out:
        out.write("\n".join(sql_statements))

    print(f"Terminé ! {count} advancements extraits dans '{OUTPUT_SQL_FILE}'.")

if __name__ == "__main__":
    main()