FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY scripts/cloudsql-migrate.mjs scripts/import-celestial-seasonings.mjs scripts/ingest-molecules-postgres.mjs scripts/terproduct-all-migrations.sql scripts/
COPY .migration-data/celestial-products.json /app/data/celestial-products.json
COPY data/mondays-molecules.json /app/data/mondays-molecules.json
CMD ["node", "scripts/cloudsql-migrate.mjs"]
