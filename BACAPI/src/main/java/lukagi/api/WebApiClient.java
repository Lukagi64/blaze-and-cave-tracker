package lukagi.api;

import lukagi.config.PluginConfig;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Client HTTP asynchrone pour communiquer avec l'API web.
 * Utilise java.net.http (disponible depuis Java 11) - pas de dépendance externe.
 */
public class WebApiClient {

    private final PluginConfig config;
    private final HttpClient httpClient;

    public WebApiClient(PluginConfig config) {
        this.config = config;
        // Client HTTP réutilisable (pool de connexions, timeouts)
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(config.apiTimeoutMs))
                .build();
    }

    /**
     * Envoie un advancement complété au site web de façon ASYNCHRONE.
     * Ne bloque PAS le thread principal du serveur.
     *
     * @param playerUuid UUID du joueur
     * @param advancementKey Clé technique de l'advancement (ex: "blazeandcave:nether/into_the_fire")
     * @return CompletableFuture qui se complète quand la requête finit (succès ou échec)
     */
    public CompletableFuture<Void> sendAdvancementCompletion(UUID playerUuid, String advancementKey) {
        // URL complète : http://localhost:3000/api/advancements/blazeandcave:nether/into_the_fire/complete
        String url = config.apiBaseUrl + "/api/advancements/" + advancementKey + "/complete";

        // Corps JSON : { "player_uuid": "xxx-xxx-xxx" }
        String jsonBody = String.format("{\"player_uuid\":\"%s\"}", playerUuid);

        // Construire la requête HTTP
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(config.apiTimeoutMs))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

        // Ajouter le token d'auth si configuré
        if (config.apiAuthToken != null && !config.apiAuthToken.isEmpty()) {
            requestBuilder.header("Authorization", "Bearer " + config.apiAuthToken);
        }

        HttpRequest request = requestBuilder.build();

        // Exécuter ASYNCHRONEMENT - retourne immédiatement un CompletableFuture
        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAcceptAsync(response -> {
                    // Ce code s'exécute dans un thread du pool HTTP, PAS le thread principal
                    handleResponse(playerUuid, advancementKey, response);
                })
                .exceptionallyAsync(throwable -> {
                    // Gestion d'erreur asynchrone
                    handleError(playerUuid, advancementKey, throwable);
                    return null;
                });
    }

    private void handleResponse(UUID playerUuid, String advancementKey, HttpResponse<String> response) {
        int status = response.statusCode();

        if (status >= 200 && status < 300) {
            // Succès (200, 201, etc.)
            if (config.debugLogAdvancements) {
                logAsync(() -> Bukkit.getLogger().info(
                        "[BACAPI] Advancement envoyé : " + advancementKey + " pour " + playerUuid
                ));
            }
        } else if (status == 404) {
            // Advancement ou joueur non trouvé côté web
            logAsync(() -> Bukkit.getLogger().warning(
                    "[BACAPI] Non trouvé (404) : " + advancementKey + " pour " + playerUuid +
                            " - Vérifiez que l'advancement existe dans la DB web"
            ));
        } else if (status == 401 || status == 403) {
            // Problème d'authentification
            logAsync(() -> Bukkit.getLogger().severe(
                    "[BACAPI] Erreur auth (" + status + ") : Token invalide ou manquant. " +
                            "Vérifiez api.auth-token dans config.yml et API_SECRET_TOKEN dans le .env du site"
            ));
        } else {
            // Autre erreur HTTP
            logAsync(() -> Bukkit.getLogger().warning(
                    "[BACAPI] Erreur HTTP " + status + " : " + advancementKey + " pour " + playerUuid +
                            " - Réponse : " + response.body()
            ));
        }
    }

    private void handleError(UUID playerUuid, String advancementKey, Throwable throwable) {
        if (config.debugLogErrors) {
            String errorMsg = throwable.getMessage();
            boolean isTimeout = throwable instanceof java.util.concurrent.TimeoutException
                    || (errorMsg != null && errorMsg.contains("timeout"));

            if (isTimeout) {
                logAsync(() -> Bukkit.getLogger().warning(
                        "[BACAPI] Timeout (" + config.apiTimeoutMs + "ms) : " + advancementKey +
                                " pour " + playerUuid + " - Le site web ne répond pas"
                ));
            } else if (throwable instanceof java.net.ConnectException
                    || (errorMsg != null && errorMsg.contains("Connection refused"))) {
                logAsync(() -> Bukkit.getLogger().warning(
                        "[BACAPI] Connexion refusée : " + advancementKey + " pour " + playerUuid +
                                " - Vérifiez que le site web est démarré sur " + config.apiBaseUrl
                ));
            } else {
                logAsync(() -> Bukkit.getLogger().severe(
                        "[BACAPI] Erreur envoi " + advancementKey + " : " + throwable.getClass().getSimpleName() +
                                " - " + (errorMsg != null ? errorMsg : "cause inconnue")
                ));
            }
        }
    }

    /**
     * Log dans le thread principal Bukkit (thread-safe pour la console)
     */
    private void logAsync(Runnable logTask) {
        if (Bukkit.isPrimaryThread()) {
            logTask.run();
        } else {
            Bukkit.getScheduler().runTask(Bukkit.getPluginManager().getPlugin("BACAPI"), logTask);
        }
    }

    /**
     * Ferme le client HTTP (appelé à la désactivation du plugin)
     */
    public void shutdown() {
        // HttpClient.close() disponible depuis Java 21
        if (Runtime.version().feature() >= 21) {
            try {
                java.lang.reflect.Method closeMethod = HttpClient.class.getMethod("close");
                closeMethod.invoke(httpClient);
            } catch (Exception ignored) {
                // Ignoré : le GC nettoiera
            }
        }
        // Sur Java < 21 : pas de close(), le pool sera nettoyé par le GC
    }

    /**
     * Retourne le HttpClient interne pour réutilisation (ex: test de connectivité)
     */
    public HttpClient getHttpClient() {
        return httpClient;
    }
}