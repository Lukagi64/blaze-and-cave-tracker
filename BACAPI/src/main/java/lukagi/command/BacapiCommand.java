package lukagi.command;

import lukagi.BACAPI;
import lukagi.api.WebApiClient;
import lukagi.config.PluginConfig;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Commande /bacapi pour gérer le plugin en jeu.
 * Usage :
 *   /bacapi reload        - Recharge config.yml
 *   /bacapi status        - Affiche l'état de la connexion
 *   /bacapi test <player> - Test d'envoi d'un advancement fictif
 */
public class BacapiCommand implements CommandExecutor, TabCompleter {

    private final BACAPI plugin;

    public BacapiCommand(BACAPI plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sendHelp(sender);
            return true;
        }

        String subCommand = args[0].toLowerCase();

        switch (subCommand) {
            case "reload":
                return handleReload(sender);

            case "status":
                return handleStatus(sender);

            case "test":
                return handleTest(sender, args);

            default:
                sender.sendMessage(ChatColor.RED + "Sous-commande inconnue : " + subCommand);
                sendHelp(sender);
                return true;
        }
    }

    private boolean handleReload(CommandSender sender) {
        if (!sender.hasPermission("bacapi.admin")) {
            sender.sendMessage(ChatColor.RED + "Permission refusée : bacapi.admin requise");
            return true;
        }

        plugin.getPluginConfig().reload();
        sender.sendMessage(ChatColor.GREEN + "§a[BACAPI] Configuration rechargée depuis config.yml");
        sender.sendMessage(ChatColor.GRAY + "  API URL : " + plugin.getPluginConfig().apiBaseUrl);
        sender.sendMessage(ChatColor.GRAY + "  Timeout : " + plugin.getPluginConfig().apiTimeoutMs + "ms");
        sender.sendMessage(ChatColor.GRAY + "  Namespace filtré : " + plugin.getPluginConfig().filterNamespace);
        return true;
    }

    private boolean handleStatus(CommandSender sender) {
        PluginConfig config = plugin.getPluginConfig();

        sender.sendMessage(ChatColor.GOLD + "=== [BACAPI] Statut ===");
        sender.sendMessage(ChatColor.GRAY + "  API URL : " + ChatColor.WHITE + config.apiBaseUrl);
        sender.sendMessage(ChatColor.GRAY + "  Auth token : " + ChatColor.WHITE + (config.apiAuthToken.isEmpty() ? ChatColor.RED + "NON CONFIGURÉ" : ChatColor.GREEN + "CONFIGURÉ"));
        sender.sendMessage(ChatColor.GRAY + "  Timeout : " + ChatColor.WHITE + config.apiTimeoutMs + "ms");
        sender.sendMessage(ChatColor.GRAY + "  Namespace : " + ChatColor.WHITE + config.filterNamespace);
        sender.sendMessage(ChatColor.GRAY + "  Debug advancements : " + ChatColor.WHITE + (config.debugLogAdvancements ? "ON" : "OFF"));
        sender.sendMessage(ChatColor.GRAY + "  Debug errors : " + ChatColor.WHITE + (config.debugLogErrors ? "ON" : "OFF"));

        // Test de connectivité rapide (asynchrone, non bloquant)
        sender.sendMessage(ChatColor.GRAY + "  Test de connexion : " + ChatColor.YELLOW + "En cours...");
        testConnectivity(sender);
        return true;
    }

    private void testConnectivity(CommandSender sender) {
        // Ping simple vers l'API pour vérifier la connectivité
        // On utilise l'endpoint /api/home qui existe déjà
        // Réutilise le HttpClient du plugin (timeouts configurés, pool partagé)
        String url = plugin.getPluginConfig().apiBaseUrl + "/api/home";

        HttpClient client = plugin.getApiClient().getHttpClient();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(3000))
                .GET()
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAcceptAsync(response -> {
                    String msg;
                    if (response.statusCode() == 200) {
                        msg = ChatColor.GREEN + "  Test de connexion : " + ChatColor.WHITE + "OK (HTTP 200)";
                    } else {
                        msg = ChatColor.RED + "  Test de connexion : " + ChatColor.WHITE + "ÉCHEC (HTTP " + response.statusCode() + ")";
                    }
                    // Log dans le thread principal
                    plugin.getServer().getScheduler().runTask(plugin, () -> sender.sendMessage(msg));
                })
                .exceptionallyAsync(throwable -> {
                    String msg = ChatColor.RED + "  Test de connexion : " + ChatColor.WHITE + "ÉCHEC - " + throwable.getClass().getSimpleName();
                    plugin.getServer().getScheduler().runTask(plugin, () -> sender.sendMessage(msg));
                    return null;
                });
    }

    private boolean handleTest(CommandSender sender, String[] args) {
        if (!sender.hasPermission("bacapi.admin")) {
            sender.sendMessage(ChatColor.RED + "Permission refusée : bacapi.admin requise");
            return true;
        }

        if (args.length < 2) {
            sender.sendMessage(ChatColor.RED + "Usage : /bacapi test <joueur> [advancement_key]");
            return true;
        }

        String playerName = args[1];
        Player target = plugin.getServer().getPlayerExact(playerName);

        if (target == null) {
            sender.sendMessage(ChatColor.RED + "Joueur introuvable : " + playerName);
            return true;
        }

        // Advancement de test : argument optionnel, sinon un advancement réel connu
        String testAdvancement = (args.length >= 3) ? args[2] : "blazeandcave:nether/into_the_fire";
        plugin.getApiClient().sendAdvancementCompletion(target.getUniqueId(), testAdvancement);

        sender.sendMessage(ChatColor.GREEN + "Test envoyé pour " + target.getName() + " (advancement: " + testAdvancement + ")");
        sender.sendMessage(ChatColor.GRAY + "Vérifiez les logs du site web et la console serveur");
        return true;
    }

    private void sendHelp(CommandSender sender) {
        sender.sendMessage(ChatColor.GOLD + "=== Commandes BACAPI ===");
        sender.sendMessage(ChatColor.YELLOW + "/bacapi reload" + ChatColor.GRAY + " - Recharge config.yml");
        sender.sendMessage(ChatColor.YELLOW + "/bacapi status" + ChatColor.GRAY + " - Affiche l'état et test la connexion");
        sender.sendMessage(ChatColor.YELLOW + "/bacapi test <joueur> [advancement_key]" + ChatColor.GRAY + " - Test d'envoi (admin seulement)");
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return Arrays.asList("reload", "status", "test");
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("test")) {
            // Suggestions de noms de joueurs en ligne
            return plugin.getServer().getOnlinePlayers().stream()
                    .map(Player::getName)
                    .toList();
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("test")) {
            // Suggestions d'advancements Blaze&Cave connus
            return Arrays.asList(
                    "blazeandcave:nether/into_the_fire",
                    "blazeandcave:mining/diamonds",
                    "blazeandcave:adventure/kill_all_mobs",
                    "blazeandcave:end/dragon"
            );
        }
        return Collections.emptyList();
    }
}