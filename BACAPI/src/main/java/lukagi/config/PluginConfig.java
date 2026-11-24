package lukagi.config;

import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * Gestion de la configuration du plugin.
 * Charge config.yml depuis resources au premier démarrage, puis utilise la copie dans plugins/BACAPI/
 */
public class PluginConfig {

    private final JavaPlugin plugin;
    private FileConfiguration config;
    private File configFile;

    // Valeurs de configuration
    public String apiBaseUrl;
    public String apiAuthToken;
    public int apiTimeoutMs;
    public String filterNamespace;
    public boolean debugLogAdvancements;
    public boolean debugLogErrors;

    public PluginConfig(JavaPlugin plugin) {
        this.plugin = plugin;
        load();
    }

    private void load() {
        // 1. Créer le dossier du plugin s'il n'existe pas
        if (!plugin.getDataFolder().exists()) {
            plugin.getDataFolder().mkdirs();
        }

        // 2. Fichier config.yml dans plugins/BACAPI/
        configFile = new File(plugin.getDataFolder(), "config.yml");

        // 3. Copier le config.yml par défaut depuis resources si absent
        if (!configFile.exists()) {
            plugin.saveResource("config.yml", false);
            plugin.getLogger().info("config.yml créé depuis les ressources par défaut");
        }

        // 4. Charger la configuration
        config = YamlConfiguration.loadConfiguration(configFile);

        // 5. Lire les valeurs avec des valeurs par défaut sûres
        apiBaseUrl = config.getString("api.base-url", "http://localhost:3000").replaceAll("/+$", ""); // Supprimer le slash final
        apiAuthToken = config.getString("api.auth-token", "");
        apiTimeoutMs = config.getInt("api.timeout-ms", 5000);
        filterNamespace = config.getString("filter.namespace", "blazeandcave");
        debugLogAdvancements = config.getBoolean("debug.log-advancements", true);
        debugLogErrors = config.getBoolean("debug.log-errors", true);

        if (apiAuthToken.isEmpty()) {
            plugin.getLogger().warning("api.auth-token non configuré — les requêtes seront rejetées (401) par le site web");
        }

        plugin.getLogger().info("Configuration chargée : API = " + apiBaseUrl);
    }

    /**
     * Recharge la configuration depuis le fichier (utile pour /bacapi reload)
     */
    public void reload() {
        config = YamlConfiguration.loadConfiguration(configFile);
        apiBaseUrl = config.getString("api.base-url", "http://localhost:3000").replaceAll("/+$", "");
        apiAuthToken = config.getString("api.auth-token", "");
        apiTimeoutMs = config.getInt("api.timeout-ms", 5000);
        filterNamespace = config.getString("filter.namespace", "blazeandcave");
        debugLogAdvancements = config.getBoolean("debug.log-advancements", true);
        debugLogErrors = config.getBoolean("debug.log-errors", true);
        plugin.getLogger().info("Configuration rechargée");
    }

    /**
     * Sauvegarde la configuration actuelle dans le fichier
     */
    public void save() {
        try {
            config.save(configFile);
        } catch (IOException e) {
            plugin.getLogger().severe("Impossible de sauvegarder config.yml : " + e.getMessage());
        }
    }
}