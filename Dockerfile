FROM node:20-slim

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create the database
RUN npm run create-db

# Run the server directly with tsx (TypeScript executor)
ENTRYPOINT ["npx", "tsx", "src/server.ts"]