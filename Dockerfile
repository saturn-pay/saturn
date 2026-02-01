# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src/ src/
COPY tsconfig.json ./
COPY drizzle.config.ts ./

RUN npx tsc

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000

CMD ["node", "dist/index.js"]
