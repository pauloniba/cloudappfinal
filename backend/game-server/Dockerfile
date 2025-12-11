FROM node:18-alpine

WORKDIR /app

# Copy ONLY the game-server package files
COPY backend/game-server/package*.json ./

RUN npm install

# Copy the rest of the game-server folder
COPY backend/game-server/. .

EXPOSE 3000

CMD ["node", "server.js"]
