# Node.js component — placeholder for future Twilio/WebSocket media handling
# Build: docker build -f src/nodejs/Dockerfile -t legal-intake-voice-node .

FROM node:18-alpine

WORKDIR /app

COPY src/nodejs/package.json ./
RUN npm install --omit=dev

COPY src/nodejs/*.js ./
CMD ["node", "index.js"]
