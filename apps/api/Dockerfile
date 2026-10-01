FROM node:24-alpine AS build

WORKDIR /app

COPY --chmod=0644 apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

COPY prisma ./prisma

RUN npx prisma generate --schema=./prisma/schema.prisma

COPY apps/api/nest-cli.json apps/api/tsconfig.json ./
COPY apps/api/src ./src
COPY apps/api/test ./test

RUN npm run build


FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --chmod=0644 apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/private-media && chown node:node /app/private-media && chmod 700 /app/private-media

USER node

# Fail the build if the runtime user cannot load the application.
RUN node -e "require('./package.json'); require('./dist/app.module.js'); require('sharp')"

EXPOSE 3000

CMD ["node", "dist/main.js"]
