# ---------- BUILD STAGE ----------
FROM node:20-alpine AS builder

WORKDIR /app

# копируем package.json отдельно (кеш зависимостей)
COPY package*.json ./

RUN npm install

# копируем остальной код
COPY . .

# собираем TypeScript
RUN npm run build


# ---------- RUNTIME STAGE ----------
FROM node:20-alpine

WORKDIR /app

# только production зависимости
COPY package*.json ./
RUN npm install --omit=dev

# копируем уже собранный dist
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
