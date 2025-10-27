# Use ARM64 Node 22 Alpine as base image
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code, TypeScript configuration, and data directory
COPY src ./src
COPY tsconfig.json ./
COPY data ./data

# Build TypeScript to JavaScript
RUN yarn build

# Remove dev dependencies to reduce image size
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# Expose the application port
EXPOSE 8000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Start the MCP server
CMD ["node", "dist/mcpServer/main.js"]

