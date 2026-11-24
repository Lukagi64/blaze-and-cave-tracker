package lukagi.listener;

import lukagi.api.WebApiClient;
import lukagi.config.PluginConfig;
import org.bukkit.Bukkit;
import org.bukkit.advancement.Advancement;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.UUID;

/**
 * Écoute l'événement PlayerAdvancementDoneEvent.
 * Ne traite QUE les advancements du namespace "blazeandcave".
 * Envoie au site web de façon ASYNCHRONE via WebApiClient.
 */
public class AdvancementListener implements Listener {

    private final JavaPlugin plugin;
    private final PluginConfig config;
    private final WebApiClient apiClient;

    public AdvancementListener(JavaPlugin plugin, PluginConfig config, WebApiClient apiClient) {
        this.plugin = plugin;
        this.config = config;
        this.apiClient = apiClient;
    }

    @EventHandler(ignoreCancelled = true)
    public void onAdvancementDone(PlayerAdvancementDoneEvent event) {
        // 1. Récupérer l'advancement qui vient d'être complété
        Advancement advancement = event.getAdvancement();

        // 2. Récupérer la clé technique (NamespacedKey)
        // Format : namespace:path (ex: blazeandcave:nether/into_the_fire)
        String advancementKey = advancement.getKey().toString();

        // 3. FILTRAGE CRUCIAL : ne traiter que les advancements Blaze&Cave
        // Le namespace est la partie avant les deux-points
        String namespace = advancement.getKey().getNamespace();

        if (!namespace.equals(config.filterNamespace)) {
            // Ce n'est pas un advancement Blaze&Cave (ex: minecraft:story/mine_stone)
            // On ignore silencieusement - ne pas logger pour ne pas spammer la console
            return;
        }

        // 4. Récupérer le joueur
        var player = event.getPlayer();
        UUID playerUuid = player.getUniqueId();

        // 5. Log de débogage (dans le thread principal, OK ici car event est déjà sur main thread)
        if (config.debugLogAdvancements) {
            plugin.getLogger().info("[BACAPI] Advancement détecté : " + advancementKey + " par " + player.getName());
        }

        // 6. ENVOI ASYNCHRONE au site web
        // Ceci ne bloque PAS le thread principal du serveur !
        // La requête HTTP se fait en arrière-plan via CompletableFuture
        apiClient.sendAdvancementCompletion(playerUuid, advancementKey);
    }
}