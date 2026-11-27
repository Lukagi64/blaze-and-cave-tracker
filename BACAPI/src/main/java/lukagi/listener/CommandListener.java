package lukagi.listener;

import lukagi.BACAPI;
import lukagi.api.WebApiClient;
import lukagi.config.PluginConfig;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

/**
 * Écoute les commandes joueur pour détecter la révocation d'advancements
 * Quand le mode debug est activé et que /advancement revoke @a everything est exécutée,
 * vide la table Progression via l'API web.
 */
public class CommandListener implements Listener {

    private static final String REVOKE_COMMAND = "advancement revoke";

    private final BACAPI plugin;
    private final PluginConfig config;
    private final WebApiClient apiClient;

    public CommandListener(BACAPI plugin, PluginConfig config, WebApiClient apiClient) {
        this.plugin = plugin;
        this.config = config;
        this.apiClient = apiClient;
    }

    @EventHandler(ignoreCancelled = true)
    public void onPlayerCommand(PlayerCommandPreprocessEvent event) {
        if (!config.debugMode) {
            return; // Mode debug désactivé, on ignore
        }

        String command = event.getMessage(); // Contient le message brut avec le /
        String commandLower = command.toLowerCase();

        // Debug: log la commande reçue
        plugin.getLogger().info("[BACAPI] Debug: Commande joueur reçue: " + command);

        // Détecter /advancement revoke @a everything (ou @p, @e, etc.)
        if (commandLower.contains(REVOKE_COMMAND) && commandLower.contains("everything")) {
            plugin.getLogger().info("[BACAPI] Debug mode: commande de révocation détectée (" + command + ") - suppression de toutes les progressions");

            // Appeler l'API web pour vider la table Progression
            clearAllProgression();
        }
    }

    private void clearAllProgression() {
        String url = config.apiBaseUrl + "/api/debug/progression";
        HttpClient client = apiClient.getHttpClient();

        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(config.apiTimeoutMs))
                .header("Content-Type", "application/json")
                .DELETE();

        // Ajouter le token d'auth si configuré
        String authToken = config.apiAuthToken;
        if (authToken != null && !authToken.isEmpty()) {
            requestBuilder.header("Authorization", "Bearer " + authToken);
        }

        HttpRequest request = requestBuilder.build();

        CompletableFuture<HttpResponse<String>> future = client.sendAsync(request, HttpResponse.BodyHandlers.ofString());

        future.thenAcceptAsync(response -> {
            String msg;
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                msg = "[BACAPI] Debug: Table Progression vidée suite à la révocation (HTTP " + response.statusCode() + ")";
                plugin.getLogger().info(msg);
            } else if (response.statusCode() == 401 || response.statusCode() == 403) {
                msg = "[BACAPI] Debug: Erreur auth (" + response.statusCode() + ") - Token invalide pour vider les progressions";
                plugin.getLogger().severe(msg);
            } else {
                msg = "[BACAPI] Debug: Échec vidage progressions (HTTP " + response.statusCode() + ") - " + response.body();
                plugin.getLogger().warning(msg);
            }
        }).exceptionallyAsync(throwable -> {
            plugin.getLogger().warning("[BACAPI] Debug: Erreur lors du vidage des progressions - " +
                    throwable.getClass().getSimpleName() + " - " + throwable.getMessage());
            return null;
        });
    }
}