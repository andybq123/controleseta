# Build do frontend (painel web)
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build do backend (API + coletor + scheduler)
FROM node:20-alpine AS backend-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# Imagem final de execucao
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY backend/package.json ./
RUN npm install --omit=dev

COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 4000
CMD ["node", "dist/index.js"]
