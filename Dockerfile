# ============================================================
# Stage 1: Build the Vite application
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Set build-time environment variables
ENV BASE_PATH=/fleet/
ENV API_PROXY_TARGET=http://backend:5001

# Build the Vite application
RUN npm run build

# ============================================================
# Stage 2: Serve with Nginx (static files + API reverse proxy)
# ============================================================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Create custom nginx config
RUN cat > /etc/nginx/conf.d/mistri360.conf << 'EOF'
server {
    listen 18231;
    server_name _;
    resolver 127.0.0.11 valid=10s;
    resolver_timeout 5s;

    # Serve static files from /fleet/ base path
    location /fleet/ {
        alias /usr/share/nginx/html/;
        try_files $uri $uri/ /fleet/index.html;
    }

    # Redirect root to /fleet/
    location = / {
        return 302 /fleet/;
    }

    # Reverse proxy API requests to the backend
    location /api/ {
        set $backend_host "backend:5001";
        proxy_pass http://$backend_host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
}
EOF

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 18231

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:18231/fleet/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
