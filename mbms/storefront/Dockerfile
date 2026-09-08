# Builds the Customer Storefront React/Vite app into a static bundle
# served by nginx, with /api reverse-proxied to the backend container —
# mirrors mbms/frontend/Dockerfile exactly (see its comments), just for the
# customer-facing app on its own port.
#
#   docker build -t mbms-storefront .
#   docker run -p 5174:80 mbms-storefront

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
