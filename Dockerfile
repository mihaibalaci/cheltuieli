# ---- Build frontend ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Production image ----
FROM node:20-alpine
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/cheltuieli.db

WORKDIR /app/backend
CMD ["node", "server.js"]
