FROM node:20-alpine

WORKDIR /app

# Copy server files and install dependencies
COPY server/package*.json ./
RUN npm install
COPY server/ ./

# Copy pre-built client files to server's expected location
COPY client/build/ ./client/build/

# Build server
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]