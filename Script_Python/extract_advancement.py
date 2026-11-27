import json
from pathlib import Path

# === CONFIGURATION ===
# Chemin vers le dossier contenant les advancements du datapack décompressé
DATAPACK_ADVANCEMENTS_DIR = Path("./BlazeandCave's Advancements Pack 1.21.1/data/blazeandcave/advancement")
NAMESPACE = "blazeandcave"
OUTPUT_SQL_FILE = Path("./seed_advancements.sql")

# Optionnel : chemin vers un fichier de traduction français (BACAP Language Pack)
# Format attendu: {"advancement.blazeandcave.category.name": "Nom français", ...}
# ou {"blazeandcave:category/name": "Nom français", ...}
LANGUAGE_PACK_FR = Path("./BACAP Language Pack 1.21/assets/minecraft/lang/fr_fr.json")

# Correspondance entre le "frame" Minecraft et ta difficulté
FRAME_TO_DIFFICULTY = {
    "task": "vert",
    "goal": "bleu",
    "challenge": "violet",
    "super challenge": "rouge",
    "milestone": "jaune",
    "secret": "rose"
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

def load_french_translations(path: Path) -> dict:
    """Charge les traductions françaises depuis un fichier de language pack (supporte les commentaires #)."""
    if not path.exists():
        print(f"Avertissement : Fichier de traduction non trouvé : {path}")
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        # Strip JavaScript-style comments (# ...) before JSON parsing
        lines = []
        for line in content.split('\n'):
            # Remove inline comments but keep strings
            in_string = False
            escape_next = False
            clean_line = []
            for i, char in enumerate(line):
                if not in_string and char == '#' and (i == 0 or line[i-1] != '\\'):
                    break  # Comment starts, ignore rest of line
                if char == '"' and not escape_next:
                    in_string = not in_string
                escape_next = (char == '\\' and not escape_next)
                clean_line.append(char)
            lines.append(''.join(clean_line))
        clean_content = '\n'.join(lines)
        data = json.loads(clean_content)
        print(f"Traductions françaises chargées : {len(data)} entrées")
        return data
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"Erreur lecture fichier traduction : {e}")
        return {}

def get_french_name(translations: dict, technical_key: str, default_name: str) -> str:
    """
    Trouve le nom français pour une advancement.
    Essaie plusieurs formats de clés possibles.
    """
    # Format 1: advancement.blazeandcave.category.name
    parts = technical_key.split(':')
    if len(parts) == 2:
        ns, rest = parts
        key1 = f"advancement.{ns}.{rest.replace('/', '.')}"
        if key1 in translations:
            return translations[key1]

    # Format 2: blazeandcave:category/name (clé technique directe)
    if technical_key in translations:
        return translations[technical_key]

    # Format 3: advancement.category.name (sans namespace)
    if len(parts) == 2:
        key3 = f"advancement.{rest.replace('/', '.')}"
        if key3 in translations:
            return translations[key3]

    # Format 4: English display name as key (used in BACAP language pack)
    if default_name in translations:
        return translations[default_name]

    return None

def main():
    if not DATAPACK_ADVANCEMENTS_DIR.exists():
        print(f"Erreur : Le dossier '{DATAPACK_ADVANCEMENTS_DIR}' est introuvable.")
        return

    # Charger les traductions françaises si disponibles
    translations_fr = load_french_translations(LANGUAGE_PACK_FR)

    sql_statements = [
        "-- Fichier généré automatiquement depuis le datapack Blaze&Cave's Advancement",
        "BEGIN TRANSACTION;\n"
    ]

    count = 0
    count_fr = 0

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

        # Récupération de l'icône (item ID)
        icon_data = display.get("icon")
        icon_id = None
        if isinstance(icon_data, dict):
            icon_id = icon_data.get("id")

        # Chercher le nom français
        name_fr = get_french_name(translations_fr, technical_key, name)
        if name_fr:
            count_fr += 1

        frame = display.get("frame", "task")
        difficulty = FRAME_TO_DIFFICULTY.get(frame, "vert")

        # Génération de la requête INSERT
        fields = "technical_key, name, category, difficulty"
        values = f"'{escape_sql(technical_key)}', '{escape_sql(name)}', '{escape_sql(category)}', '{escape_sql(difficulty)}'"

        if name_fr:
            fields += ", name_fr"
            values += f", '{escape_sql(name_fr)}'"
        if icon_id:
            fields += ", icon"
            values += f", '{escape_sql(icon_id)}'"

        sql = f"INSERT OR IGNORE INTO Advancement ({fields}) VALUES ({values});"
        sql_statements.append(sql)
        count += 1

    sql_statements.append("\nCOMMIT;")

    with open(OUTPUT_SQL_FILE, "w", encoding="utf-8") as out:
        out.write("\n".join(sql_statements))

    print(f"Terminé ! {count} advancements extraits ({count_fr} avec traduction FR) dans '{OUTPUT_SQL_FILE}'.")

if __name__ == "__main__":
    main()