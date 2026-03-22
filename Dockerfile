FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; else bun install; fi

COPY . .

ENV NODE_ENV=production
ENV SELF_HOSTED=true
ENV PORT=3001

RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SELF_HOSTED=true
ENV PORT=3001

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.output ./.output

EXPOSE 3001

CMD ["bun", "run", "start"]