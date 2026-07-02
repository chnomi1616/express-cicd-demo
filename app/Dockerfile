# --- Base image ---
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only package files first (Docker layer caching = faster rebuilds)
COPY package*.json ./

# Install only production dependencies (no jest/supertest in the final image)
RUN npm ci --omit=dev

# Copy the rest of the app code
COPY . .

# The app listens on this port (matches PORT in index.js)
EXPOSE 3000

# Basic healthcheck so `docker ps` shows container health status
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1

# Command to run the app
CMD ["node", "index.js"]
