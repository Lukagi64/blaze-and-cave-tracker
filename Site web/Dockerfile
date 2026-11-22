# ============================================
# Dockerfile - Blaze & Cave Tracker API
# Multi-stage build pour image de production optimisée
# ============================================

# ---- Stage 1: Build dependencies ----
FROM node:22-alpine AS builder

# Installer les outils de compilation pour better-sqlite3 (native addon)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copier seulement les fichiers de dépendances pour profiter du cache Docker
COPY package*.json ./

# Installer TOUTES les dépendances (dev + prod) pour le build
RUN npm ci

# Copier le code source
COPY src ./src
COPY db ./db
COPY public ./public

# ---- Stage 2: Production runtime ----
FROM node:22-alpine AS runner

# Utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copier node_modules depuis le builder (inclut better-sqlite3 compilé)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copier le code applicatif
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/db ./db
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Créer le dossier data pour la base SQLite (volume monté)
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Variables d'environnement par défaut
ENV PORT=3000 \
    DB_PATH=/app/data/database.sqlite \
    NODE_ENV=production

# Utilisateur non-root
USER nodejs

# Health check pour Docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (res) => {process.exit(res.statusCode === 200 ? 0 : 1)})"

EXPOSE 3000

CMD ["node", "src/server.js"]