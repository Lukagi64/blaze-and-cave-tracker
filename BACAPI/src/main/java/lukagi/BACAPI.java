package lukagi;

import lukagi.api.WebApiClient;
import lukagi.command.BacapiCommand;
import lukagi.config.PluginConfig;
import lukagi.listener.AdvancementListener;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Point d'entrée principal du plugin BACAPI.
 * Wire ensemble : Config → WebApiClient → AdvancementListener
 */
public final class BACAPI extends JavaPlugin {

    private PluginConfig config;
    private WebApiClient apiClient;
    private AdvancementListener advancementListener;

    @Override
    public void onEnable() {
        // 1. Charger la configuration
        config = new PluginConfig(this);

        // 2. Créer le client HTTP pour l'API web
        apiClient = new WebApiClient(config);

        // 3. Créer et enregistrer le listener d'advancements
        advancementListener = new AdvancementListener(this, config, apiClient);
        getServer().getPluginManager().registerEvents(advancementListener, this);

        // 4. Enregistrer la commande /bacapi pour le reload
        getCommand("bacapi").setExecutor(new BacapiCommand(this));

        getLogger().info("§aBACAPI activé ! Écoute les advancements blazeandcave: sur " + config.apiBaseUrl);
    }

    @Override
    public void onDisable() {
        // Nettoyage propre : fermer le client HTTP
        if (apiClient != null) {
            apiClient.shutdown();
        }
        getLogger().info("§cBACAPI désactivé");
    }

    // Getters pour la commande /bacapi reload
    public PluginConfig getPluginConfig() {
        return config;
    }

    public WebApiClient getApiClient() {
        return apiClient;
    }
}