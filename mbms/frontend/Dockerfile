# Builds the staff Admin React/Vite app into a static bundle served by
# nginx, with /api reverse-proxied to the backend container — the same
# same-origin relationship `vite.config.js`'s dev-server proxy gives it in
# local development, so no CORS configuration is needed either way.
#
#   docker build -t mbms-frontend .
#   docker run -p 5173:80 mbms-frontend

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
