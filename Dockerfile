# Dockerfile для Render (Chromium + puppeteer-core)
FROM node:18-bullseye

RUN apt-get update && apt-get install -y chromium     fonts-ipafont-gothic libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3     libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0     libcairo2 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 3000
CMD ["node","server.js"]
