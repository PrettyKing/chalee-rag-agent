# Deployment Guide

This guide covers different deployment options for the Chalee RAG Agent.

## Quick Start

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run automated deployment
./scripts/deploy.sh docker production
```

## Deployment Options

### 1. Docker Deployment (Recommended)

#### Prerequisites
- Docker 20.0+
- Docker Compose 2.0+

#### Steps

1. **Prepare environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. **Deploy with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

3. **Verify deployment**:
   ```bash
   curl http://localhost:3000/health
   ```

#### Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  rag-agent:
    build: .
    ports:
      - \"3000:3000\"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  chroma:
    image: chromadb/chroma:latest
    volumes:
      - chroma_data:/chroma/chroma
    restart: unless-stopped
```

### 2. PM2 Deployment

#### Prerequisites
- Node.js 16+
- PM2 globally installed

#### Steps

1. **Install PM2**:
   ```bash
   npm install -g pm2
   ```

2. **Start application**:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

3. **Save PM2 configuration**:
   ```bash
   pm2 save
   pm2 startup
   ```

#### PM2 Commands

```bash
# Monitor applications
pm2 monit

# View logs
pm2 logs chalee-rag-agent

# Restart application
pm2 restart chalee-rag-agent

# Stop application
pm2 stop chalee-rag-agent

# Reload with zero downtime
pm2 reload chalee-rag-agent
```

### 3. Systemd Deployment

#### Prerequisites
- Linux system with systemd
- Node.js 16+
- Sudo access

#### Steps

1. **Create service file**:
   ```bash
   sudo ./scripts/deploy.sh systemd production
   ```

2. **Manual service creation**:
   ```bash
   sudo nano /etc/systemd/system/chalee-rag-agent.service
   ```

   ```ini
   [Unit]
   Description=Chalee RAG Agent
   After=network.target

   [Service]
   Type=simple
   User=ragagent
   WorkingDirectory=/opt/chalee-rag-agent
   ExecStart=/usr/bin/node server.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production
   EnvironmentFile=/opt/chalee-rag-agent/.env

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable chalee-rag-agent
   sudo systemctl start chalee-rag-agent
   ```

## Cloud Deployments

### AWS Deployment

#### Using EC2

1. **Launch EC2 instance**:
   - Ubuntu 22.04 LTS
   - t3.medium or larger
   - Security group: ports 22, 80, 443, 3000

2. **Install dependencies**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Docker
   sudo apt-get install -y docker.io docker-compose
   sudo usermod -aG docker $USER
   ```

3. **Deploy application**:
   ```bash
   git clone https://github.com/PrettyKing/chalee-rag-agent.git
   cd chalee-rag-agent
   ./scripts/deploy.sh docker production
   ```

#### Using ECS (Container Service)

1. **Build and push Docker image**:
   ```bash
   # Build image
   docker build -t chalee-rag-agent .
   
   # Tag for ECR
   docker tag chalee-rag-agent:latest 123456789012.dkr.ecr.us-west-2.amazonaws.com/chalee-rag-agent:latest
   
   # Push to ECR
   docker push 123456789012.dkr.ecr.us-west-2.amazonaws.com/chalee-rag-agent:latest
   ```

2. **Create ECS task definition**:
   ```json
   {
     \"family\": \"chalee-rag-agent\",
     \"taskRoleArn\": \"arn:aws:iam::123456789012:role/ecsTaskRole\",
     \"executionRoleArn\": \"arn:aws:iam::123456789012:role/ecsTaskExecutionRole\",
     \"networkMode\": \"awsvpc\",
     \"requiresCompatibilities\": [\"FARGATE\"],
     \"cpu\": \"1024\",
     \"memory\": \"2048\",
     \"containerDefinitions\": [
       {
         \"name\": \"rag-agent\",
         \"image\": \"123456789012.dkr.ecr.us-west-2.amazonaws.com/chalee-rag-agent:latest\",
         \"portMappings\": [
           {
             \"containerPort\": 3000,
             \"protocol\": \"tcp\"
           }
         ],
         \"environment\": [
           {
             \"name\": \"NODE_ENV\",
             \"value\": \"production\"
           }
         ],
         \"secrets\": [
           {
             \"name\": \"OPENAI_API_KEY\",
             \"valueFrom\": \"arn:aws:secretsmanager:us-west-2:123456789012:secret:openai-api-key\"
           }
         ]
       }
     ]
   }
   ```

### Google Cloud Platform

#### Using Cloud Run

1. **Build and deploy**:
   ```bash
   # Build image
   gcloud builds submit --tag gcr.io/PROJECT_ID/chalee-rag-agent
   
   # Deploy to Cloud Run
   gcloud run deploy chalee-rag-agent \\
     --image gcr.io/PROJECT_ID/chalee-rag-agent \\
     --platform managed \\
     --region us-central1 \\
     --allow-unauthenticated
   ```

2. **Set environment variables**:
   ```bash
   gcloud run services update chalee-rag-agent \\
     --set-env-vars NODE_ENV=production \\
     --set-env-vars OPENAI_API_KEY=your_api_key
   ```

### Azure Deployment

#### Using Container Instances

```bash
# Create resource group
az group create --name chalee-rg --location eastus

# Deploy container
az container create \\
  --resource-group chalee-rg \\
  --name chalee-rag-agent \\
  --image chalee/rag-agent:latest \\
  --dns-name-label chalee-rag-agent \\
  --ports 3000 \\
  --environment-variables NODE_ENV=production \\
  --secure-environment-variables OPENAI_API_KEY=your_api_key
```

## SSL/TLS Configuration

### Using Let's Encrypt with Nginx

1. **Install Certbot**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Get certificate**:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Auto-renewal**:
   ```bash
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

### Manual SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Application Monitoring

1. **PM2 Monitoring**:
   ```bash
   pm2 install pm2-server-monit
   pm2 monit
   ```

2. **Docker Monitoring**:
   ```bash
   docker stats
   docker-compose logs -f
   ```

### Log Management

1. **Centralized logging with ELK Stack**:
   ```yaml
   # docker-compose.logging.yml
   version: '3.8'
   services:
     elasticsearch:
       image: elasticsearch:7.17.0
       environment:
         - discovery.type=single-node
     
     logstash:
       image: logstash:7.17.0
       volumes:
         - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
     
     kibana:
       image: kibana:7.17.0
       ports:
         - \"5601:5601\"
   ```

2. **Log rotation**:
   ```bash
   # /etc/logrotate.d/chalee-rag-agent
   /opt/chalee-rag-agent/logs/*.log {
       daily
       missingok
       rotate 14
       compress
       delaycompress
       notifempty
       sharedscripts
       postrotate
           pm2 reloadLogs
       endscript
   }
   ```

## Security Best Practices

### 1. Environment Security

- Store sensitive data in environment variables
- Use secrets management (AWS Secrets Manager, Azure Key Vault)
- Rotate API keys regularly
- Use non-root containers

### 2. Network Security

- Use HTTPS only
- Implement rate limiting
- Set up firewall rules
- Use VPC/private networks

### 3. Application Security

```javascript
// Add security middleware
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

## Backup and Disaster Recovery

### 1. Database Backup

```bash
#!/bin/bash
# backup-chroma.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=\"/backups/chroma\"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup ChromaDB data
tar -czf $BACKUP_DIR/chroma_backup_$DATE.tar.gz /path/to/chroma_data/

# Keep only last 7 days of backups
find $BACKUP_DIR -name \"chroma_backup_*.tar.gz\" -mtime +7 -delete
```

### 2. Application Backup

```bash
# Backup application files
tar -czf app_backup_$(date +%Y%m%d).tar.gz \\
  --exclude=node_modules \\
  --exclude=chroma_data \\
  --exclude=logs \\
  /opt/chalee-rag-agent/
```

## Performance Optimization

### 1. Resource Allocation

- **CPU**: 2+ cores recommended
- **Memory**: 4GB+ recommended
- **Storage**: SSD for better I/O performance

### 2. Application Tuning

```javascript
// Optimize for production
process.env.UV_THREADPOOL_SIZE = '128';
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
```

### 3. Load Balancing

```nginx
upstream rag_backend {
    least_conn;
    server 127.0.0.1:3000 weight=1;
    server 127.0.0.1:3001 weight=1;
    server 127.0.0.1:3002 weight=1;
}

server {
    location / {
        proxy_pass http://rag_backend;
    }
}
```

## Troubleshooting

### Common Issues

1. **Memory Issues**:
   ```bash
   # Check memory usage
   free -h
   docker stats
   
   # Increase Node.js memory limit
   export NODE_OPTIONS=\"--max-old-space-size=4096\"
   ```

2. **ChromaDB Connection Issues**:
   ```bash
   # Check ChromaDB status
   curl http://localhost:8000/api/v1/heartbeat
   
   # Check Docker logs
   docker logs chalee-chromadb
   ```

3. **Port Conflicts**:
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   netstat -tulpn | grep 3000
   ```

### Health Checks

```bash
#!/bin/bash
# health-check.sh

# Check application health
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo \"✅ Application is healthy\"
else
    echo \"❌ Application health check failed\"
    exit 1
fi

# Check ChromaDB health
if curl -f http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    echo \"✅ ChromaDB is healthy\"
else
    echo \"❌ ChromaDB health check failed\"
    exit 1
fi
```

## Maintenance

### Regular Tasks

1. **Update dependencies**:
   ```bash
   npm audit
   npm update
   ```

2. **Clean up logs**:
   ```bash
   # Docker logs
   docker system prune -f
   
   # Application logs
   find ./logs -name \"*.log\" -mtime +30 -delete
   ```

3. **Monitor disk space**:
   ```bash
   df -h
   du -sh /path/to/chroma_data
   ```

For more detailed troubleshooting, see the [Troubleshooting Guide](TROUBLESHOOTING.md).`
    },
    {
      `path`: `docs/TROUBLESHOOTING.md`,
      `content`: `# Troubleshooting Guide

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