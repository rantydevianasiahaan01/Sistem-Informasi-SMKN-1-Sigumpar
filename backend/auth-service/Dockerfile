FROM node:24.22.1-alpine

RUN apk add --no-cache bash sudo postgresql18-client \
 && adduser -D -s /bin/bash delcom \
 && echo "delcom ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

WORKDIR /app

# Copy package files dan install (sebagai root dulu)
COPY package*.json ./
RUN npm install

# Copy semua file
COPY . .

# Ubah ownership semua file ke delcom
RUN chown -R delcom:delcom /app

# Kasih execute permission ke start.sh
RUN chmod +x start.sh

# Switch ke user delcom
USER delcom

EXPOSE 3005

CMD ["./start.sh"]
