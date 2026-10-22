# Single-image build: installs yt-dlp + ffmpeg, builds the web app and server,
# and serves both from one origin on $PORT. Deploy to any Docker host.
FROM node:22-slim

# Runtime tools the downloader shells out to.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
       -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install

# Build the frontend and compile the server.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# The server serves the built frontend (web/dist) and the /api routes.
CMD ["node", "server/dist/index.js"]
