# ---- build stage ----
FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/common/package.json packages/common/package.json

RUN npm install

COPY apps/api apps/api
COPY packages/common packages/common

RUN npx turbo run build --filter=@swe-challenge-stone/api...

# ---- runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /repo

ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/common ./packages/common
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
