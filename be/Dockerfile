# ---------------------------------------------------
# Stage 1: Build TypeScript source code
# ---------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------
# Stage 2: Production Runtime
# ---------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

# Sử dụng non-root user 'node' của Alpine để phòng chống đặc quyền root
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
