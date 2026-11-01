# ==============================================================================
# AI Event Planner - Frontend Production Dockerfile
# Pinned Node 20 builder, pnpm frozen lockfile, pinned Nginx 1.27 static runner
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Static Assets
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy dependency manifests and install frozen dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Set production API URL to relative /api/v1 for same-origin reverse-proxying
ENV VITE_API_BASE_URL=/api/v1 \
    VITE_APP_TITLE="AI Event Planner" \
    VITE_APP_ENV=production

# Compile TypeScript and build production bundle
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 2: Serve with Pinned Alpine Nginx
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default Nginx welcome configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
