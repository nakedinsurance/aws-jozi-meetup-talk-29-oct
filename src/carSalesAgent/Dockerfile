# Use ARM64 Node 22 Alpine as base image
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code and TypeScript configuration
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript to JavaScript
RUN yarn build
# Add after line 27 (after NODE_ENV)
ENV MCP_SERVER_URL_PROD="add_yours"
# Remove dev dependencies to reduce image size
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# Expose the application port
EXPOSE 8080

# Set NODE_ENV to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/carSalesAgent/main.js"]

