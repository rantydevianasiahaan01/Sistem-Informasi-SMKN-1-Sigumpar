# Stage 1: Build
FROM node:24.22.1-alpine AS builder

WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

RUN addgroup -g 1000 delcom \
 && adduser -D -u 1000 -G delcom -s /bin/sh delcom \
 && sed -i 's|^user  nginx;|# user delcom;|' /etc/nginx/nginx.conf \
 && sed -i 's|pid        /run/nginx.pid;|pid        /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
 && mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp \
             /var/log/nginx \
 && chown -R delcom:delcom \
      /usr/share/nginx/html \
      /var/cache/nginx \
      /var/log/nginx \
      /etc/nginx/conf.d \
      /tmp

COPY --from=builder --chown=delcom:delcom /app/dist /usr/share/nginx/html
COPY --chown=delcom:delcom nginx.conf /etc/nginx/conf.d/default.conf

USER delcom

EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
