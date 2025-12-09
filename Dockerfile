# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p documents uploads logs chroma_data

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ragagent -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R ragagent:nodejs /app

# Switch to non-root user
USER ragagent

# Expose the application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "run", "server"]