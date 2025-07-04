# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the Chalee RAG Agent.

## Quick Diagnostics

### Health Check Script

```bash
#!/bin/bash
# Run this script to check system health

echo \"🔍 Chalee RAG Agent Health Check\"
echo \"================================\"

# Check Node.js
if command -v node &> /dev/null; then
    echo \"✅ Node.js: $(node --version)\"
else
    echo \"❌ Node.js: Not installed\"
fi

# Check application
if curl -f http://localhost:3000/health &> /dev/null; then
    echo \"✅ Application: Running\"
else
    echo \"❌ Application: Not responding\"
fi

# Check ChromaDB
if curl -f http://localhost:8000/api/v1/heartbeat &> /dev/null; then
    echo \"✅ ChromaDB: Running\"
else
    echo \"❌ ChromaDB: Not responding\"
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 90 ]; then
    echo \"✅ Disk Space: ${DISK_USAGE}% used\"
else
    echo \"⚠️  Disk Space: ${DISK_USAGE}% used (WARNING)\"
fi

# Check memory
MEM_USAGE=$(free | awk 'NR==2{printf \"%.0f\", $3*100/$2}')
if [ $MEM_USAGE -lt 90 ]; then
    echo \"✅ Memory: ${MEM_USAGE}% used\"
else
    echo \"⚠️  Memory: ${MEM_USAGE}% used (WARNING)\"
fi
```

## Common Issues

### 1. Application Won't Start

#### Symptoms
- Error when running `npm start` or `npm run server`
- Process exits immediately

#### Diagnosis
```bash
# Check Node.js version
node --version

# Check if dependencies are installed
ls node_modules

# Check for syntax errors
node -c rag-agent.js
node -c server.js

# Check environment variables
cat .env
```

#### Solutions

1. **Missing Dependencies**:
   ```bash
   npm install
   ```

2. **Wrong Node.js Version**:
   ```bash
   # Install Node.js 16+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Missing Environment File**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Port Already in Use**:
   ```bash
   # Find what's using port 3000
   lsof -i :3000
   
   # Kill the process or use a different port
   export PORT=3001
   npm run server
   ```

### 2. ChromaDB Connection Issues

#### Symptoms
- \"ChromaDB connection failed\" errors
- \"Collection not found\" errors
- Timeouts when adding documents

#### Diagnosis
```bash
# Check if ChromaDB is running
curl http://localhost:8000/api/v1/heartbeat

# Check Docker containers
docker ps | grep chroma

# Check ChromaDB logs
docker logs chalee-chromadb
```

#### Solutions

1. **ChromaDB Not Running**:
   ```bash
   # Start with Docker
   docker run -d --name chalee-chromadb -p 8000:8000 chromadb/chroma
   
   # Or with docker-compose
   docker-compose up -d chroma
   ```

2. **Port Conflict**:
   ```bash
   # Check what's using port 8000
   lsof -i :8000
   
   # Use different port
   docker run -d --name chalee-chromadb -p 8001:8000 chromadb/chroma
   export CHROMA_PORT=8001
   ```

3. **Permission Issues**:
   ```bash
   # Fix ChromaDB data directory permissions
   sudo chown -R $USER:$USER ./chroma_data
   chmod -R 755 ./chroma_data
   ```

### 3. OpenAI API Issues

#### Symptoms
- \"OpenAI API error\" messages
- \"Invalid API key\" errors
- Rate limiting errors

#### Diagnosis
```bash
# Test API key
curl https://api.openai.com/v1/models \\
  -H \"Authorization: Bearer $OPENAI_API_KEY\"

# Check .env file
grep OPENAI_API_KEY .env
```

#### Solutions

1. **Invalid API Key**:
   - Verify key in OpenAI dashboard
   - Check for extra spaces or quotes in .env
   - Regenerate API key if needed

2. **Rate Limiting**:
   ```javascript
   // Add retry logic in rag-agent.js
   async getEmbedding(text, retries = 3) {
       try {
           const response = await this.openai.embeddings.create({
               model: \"text-embedding-ada-002\",
               input: text
           });
           return response.data[0].embedding;
       } catch (error) {
           if (error.status === 429 && retries > 0) {
               await new Promise(resolve => setTimeout(resolve, 1000));
               return this.getEmbedding(text, retries - 1);
           }
           throw error;
       }
   }
   ```

3. **Quota Exceeded**:
   - Check usage in OpenAI dashboard
   - Upgrade plan or add payment method
   - Implement usage tracking

### 4. Memory Issues

#### Symptoms
- \"Out of memory\" errors
- Slow performance
- Process crashes

#### Diagnosis
```bash
# Check memory usage
free -h
ps aux | grep node
top -p $(pgrep node)

# Check Node.js heap usage
node --max-old-space-size=4096 server.js
```

#### Solutions

1. **Increase Node.js Memory Limit**:
   ```bash
   export NODE_OPTIONS=\"--max-old-space-size=4096\"
   npm run server
   ```

2. **Optimize Document Processing**:
   ```javascript
   // Process documents in smaller batches
   async addDocuments(documents) {
       const batchSize = 10;
       for (let i = 0; i < documents.length; i += batchSize) {
           const batch = documents.slice(i, i + batchSize);
           await this.processBatch(batch);
           // Force garbage collection
           if (global.gc) global.gc();
       }
   }
   ```

3. **Add Memory Monitoring**:
   ```javascript
   // Add to server.js
   setInterval(() => {
       const used = process.memoryUsage();
       console.log('Memory usage:', {
           rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
           heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
           heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`
       });
   }, 30000);
   ```

### 5. Document Upload Issues

#### Symptoms
- \"File upload failed\" errors
- \"No files uploaded\" messages
- Empty document processing

#### Diagnosis
```bash
# Check upload directory permissions
ls -la uploads/

# Check file size limits
du -h uploads/*

# Test upload endpoint
curl -X POST http://localhost:3000/upload \\
  -F \"documents=@test.txt\"
```

#### Solutions

1. **Permission Issues**:
   ```bash
   sudo chown -R $USER:$USER uploads/
   chmod -R 755 uploads/
   ```

2. **File Size Limits**:
   ```javascript
   // Increase limits in server.js
   const upload = multer({ 
       storage: storage,
       limits: {
           fileSize: 10 * 1024 * 1024 // 10MB
       }
   });
   ```

3. **File Type Issues**:
   ```javascript
   // Add file validation
   const upload = multer({
       storage: storage,
       fileFilter: (req, file, cb) => {
           if (file.mimetype === 'text/plain') {
               cb(null, true);
           } else {
               cb(new Error('Only .txt files allowed'));
           }
       }
   });
   ```

## Performance Issues

### 1. Slow Query Response

#### Diagnosis
```bash
# Test query performance
time curl -X POST http://localhost:3000/query \\
  -H \"Content-Type: application/json\" \\
  -d '{\"question\": \"test question\"}'

# Check database size
curl http://localhost:3000/stats
```

#### Solutions

1. **Optimize Chunk Size**:
   ```javascript
   // Reduce chunk size for faster processing
   splitText(text, chunkSize = 500, overlap = 100) {
       // Implementation
   }
   ```

2. **Implement Caching**:
   ```javascript
   const NodeCache = require('node-cache');
   const cache = new NodeCache({ stdTTL: 600 });
   
   async query(question) {
       const cacheKey = `query:${question}`;
       const cached = cache.get(cacheKey);
       
       if (cached) return cached;
       
       const result = await this.processQuery(question);
       cache.set(cacheKey, result);
       
       return result;
   }
   ```

3. **Reduce Top-K Results**:
   ```javascript
   // Use fewer documents for faster retrieval
   async retrieve(query, topK = 3) {
       // Implementation
   }
   ```

### 2. High CPU Usage

#### Solutions

1. **Use Cluster Mode**:
   ```javascript
   // cluster.js
   const cluster = require('cluster');
   const numCPUs = require('os').cpus().length;
   
   if (cluster.isMaster) {
       for (let i = 0; i < numCPUs; i++) {
           cluster.fork();
       }
   } else {
       require('./server.js');
   }
   ```

2. **Implement Rate Limiting**:
   ```javascript
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutes
       max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/query', limiter);
   ```

## Docker Issues

### 1. Container Won't Start

#### Diagnosis
```bash
# Check container status
docker ps -a

# Check logs
docker logs chalee-rag-agent
docker logs chalee-chromadb

# Check resource usage
docker stats
```

#### Solutions

1. **Resource Constraints**:
   ```yaml
   # docker-compose.yml
   services:
     rag-agent:
       deploy:
         resources:
           limits:
             memory: 2G
           reservations:
             memory: 1G
   ```

2. **Port Conflicts**:
   ```yaml
   # Use different ports
   services:
     rag-agent:
       ports:
         - \"3001:3000\"
   ```

### 2. Volume Mount Issues

#### Solutions

```bash
# Fix permissions
sudo chown -R 1001:1001 ./documents ./uploads

# Check SELinux context (on RHEL/CentOS)
sudo setsebool -P container_manage_cgroup on
```

## Production Issues

### 1. SSL/TLS Problems

#### Diagnosis
```bash
# Test SSL certificate
openssl s_client -connect your-domain.com:443

# Check certificate expiry
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

#### Solutions

1. **Certificate Renewal**:
   ```bash
   # Renew Let's Encrypt certificate
   sudo certbot renew
   sudo systemctl reload nginx
   ```

2. **Mixed Content Issues**:
   ```nginx
   # Force HTTPS
   server {
       listen 80;
       return 301 https://$server_name$request_uri;
   }
   ```

### 2. Load Balancer Issues

#### Solutions

```nginx
# Health check configuration
upstream rag_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s backup;
}

# Health check endpoint
location /health {
    access_log off;
    proxy_pass http://rag_backend/health;
    proxy_connect_timeout 1s;
    proxy_read_timeout 1s;
}
```

## Monitoring and Alerting

### 1. Log Analysis

```bash
# Check error patterns
grep -i error logs/*.log | tail -20

# Monitor real-time logs
tail -f logs/combined.log | grep -i error

# Check for memory leaks
grep -i \"heap\" logs/*.log
```

### 2. Performance Monitoring

```javascript
// Add performance monitoring
const performanceMonitor = {
    startTime: Date.now(),
    requests: 0,
    errors: 0,
    
    logStats() {
        const uptime = Date.now() - this.startTime;
        const requestRate = this.requests / (uptime / 1000);
        const errorRate = this.errors / this.requests * 100;
        
        console.log(`Stats: ${this.requests} requests, ${requestRate.toFixed(2)} req/s, ${errorRate.toFixed(2)}% errors`);
    }
};

// Log stats every 5 minutes
setInterval(() => performanceMonitor.logStats(), 5 * 60 * 1000);
```

### 3. Automated Health Checks

```bash
#!/bin/bash
# health-monitor.sh

HEALTH_URL=\"http://localhost:3000/health\"
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
    if curl -f $HEALTH_URL > /dev/null 2>&1; then
        echo \"Health check passed\"
        exit 0
    else
        echo \"Health check failed (attempt $i/$MAX_RETRIES)\"
        if [ $i -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    fi
done

echo \"All health checks failed - restarting service\"
# Add restart logic here
sudo systemctl restart chalee-rag-agent
```

## Emergency Procedures

### 1. Service Recovery

```bash
#!/bin/bash
# emergency-restart.sh

echo \"Emergency service restart initiated\"

# Stop all services
docker-compose down
pm2 stop all
sudo systemctl stop chalee-rag-agent

# Clean up resources
docker system prune -f
npm cache clean --force

# Restart services
case \"$1\" in
    \"docker\")
        docker-compose up -d
        ;;
    \"pm2\")
        pm2 start ecosystem.config.js
        ;;
    \"systemd\")
        sudo systemctl start chalee-rag-agent
        ;;
esac

echo \"Emergency restart completed\"
```

### 2. Data Recovery

```bash
#!/bin/bash
# recover-data.sh

BACKUP_DIR=\"/backups\"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/chroma_backup_*.tar.gz | head -1)

if [ -z \"$LATEST_BACKUP\" ]; then
    echo \"No backup found\"
    exit 1
fi

echo \"Restoring from: $LATEST_BACKUP\"

# Stop services
docker-compose down

# Restore data
tar -xzf $LATEST_BACKUP -C /

# Restart services
docker-compose up -d

echo \"Data recovery completed\"
```

## Getting Help

### 1. Gathering Debug Information

```bash
#!/bin/bash
# collect-debug-info.sh

DEBUG_DIR=\"debug-$(date +%Y%m%d_%H%M%S)\"
mkdir $DEBUG_DIR

# System information
uname -a > $DEBUG_DIR/system.txt
node --version > $DEBUG_DIR/node-version.txt
npm --version > $DEBUG_DIR/npm-version.txt
docker --version > $DEBUG_DIR/docker-version.txt

# Application logs
cp logs/*.log $DEBUG_DIR/ 2>/dev/null || true

# Configuration
cp .env.example $DEBUG_DIR/
cp package.json $DEBUG_DIR/
cp docker-compose.yml $DEBUG_DIR/ 2>/dev/null || true

# System status
ps aux | grep node > $DEBUG_DIR/processes.txt
netstat -tulpn > $DEBUG_DIR/network.txt
df -h > $DEBUG_DIR/disk.txt
free -h > $DEBUG_DIR/memory.txt

# Docker status
docker ps -a > $DEBUG_DIR/docker-containers.txt 2>/dev/null || true
docker images > $DEBUG_DIR/docker-images.txt 2>/dev/null || true

echo \"Debug information collected in $DEBUG_DIR\"
tar -czf $DEBUG_DIR.tar.gz $DEBUG_DIR
echo \"Archive created: $DEBUG_DIR.tar.gz\"
```

### 2. Support Channels

- **GitHub Issues**: [Create an issue](https://github.com/PrettyKing/chalee-rag-agent/issues)
- **Documentation**: Check the [docs](.) directory
- **Community**: Join our [discussions](https://github.com/PrettyKing/chalee-rag-agent/discussions)

### 3. Reporting Bugs

When reporting issues, please include:

1. **System Information**:
   - Operating system and version
   - Node.js version
   - Docker version (if using Docker)

2. **Error Details**:
   - Exact error messages
   - Steps to reproduce
   - Expected vs actual behavior

3. **Configuration**:
   - Environment variables (without sensitive data)
   - docker-compose.yml or PM2 config
   - Any custom modifications

4. **Logs**:
   - Application logs
   - System logs
   - Docker logs (if applicable)

This comprehensive troubleshooting guide should help you resolve most common issues. If you encounter problems not covered here, please open an issue on GitHub with detailed information.