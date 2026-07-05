FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Skip Playwright browser download entirely
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm install

COPY . .

RUN npm run build
RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
