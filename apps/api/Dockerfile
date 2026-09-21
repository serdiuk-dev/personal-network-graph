FROM node:24-alpine AS build

WORKDIR /app

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

COPY prisma ./prisma

RUN npx prisma generate --schema=./prisma/schema.prisma

COPY apps/api/nest-cli.json apps/api/tsconfig.json ./
COPY apps/api/src ./src

RUN npm run build


FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
