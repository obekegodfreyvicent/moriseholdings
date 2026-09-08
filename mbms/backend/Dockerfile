# Builds the NestJS/Fastify + Prisma backend into a production image.
#
# A Debian-slim base (not Alpine) is used deliberately: Prisma's query
# engine binaries are compiled against glibc, and mixing an Alpine
# (musl-libc) build stage with a glibc runtime stage — or vice versa — is a
# common source of "Prisma Client could not locate the Query Engine" errors.
# Using the same base for both stages sidesteps that entirely.
#
#   docker build -t mbms-backend .
#   docker run -p 3001:3001 --env-file .env mbms-backend

FROM node:20-bookworm-slim AS build
WORKDIR /app

# Prisma's query engine links against OpenSSL and can't detect it on the
# bare -slim image (it falls back to guessing a version, which is fragile
# across Debian releases) — installing it explicitly is Prisma's own
# documented fix for this exact warning.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Generate the Prisma Client before copying the rest of the source, so this
# layer only re-runs when the schema changes, not on every source edit.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
# nest build (not a bare tsc) — nest-cli.json wires in the @nestjs/swagger
# CLI plugin, which only runs under nest build/start and is what populates
# the OpenAPI document's request/response schemas from the class-validator
# DTOs. See mbms/README.md "Running it" for the same note.
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Carry over the Prisma Client generated in the build stage (same base
# image, so the compiled query-engine binary is compatible) rather than
# re-running `prisma generate` here, which would need the `prisma` CLI —
# a devDependency this stage deliberately omits.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main.js"]
