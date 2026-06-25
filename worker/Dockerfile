FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Manifests primeiro pra aproveitar cache
COPY package.json ./
RUN npm install --omit=optional

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

ENV NODE_ENV=production
ENV HEADLESS=true

CMD ["node", "dist/index.js"]