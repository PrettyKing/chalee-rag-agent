# 内存优化指南

## 🚨 内存溢出问题解决方案

如果你遇到了 `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` 错误，这个指南将帮你解决问题。

## 🔍 问题原因

Node.js默认的内存限制通常不足以处理大量文档的向量化操作，特别是当：

- 处理大型文档集合
- 同时向量化多个文档
- 系统内存不足
- 没有适当的内存管理

## ⚡ 立即解决方案

### 1. 使用内存优化版本

```bash
# 使用优化版本的服务器
npm run server:optimized

# 或者使用优化版本的命令行
npm run start:optimized
```

### 2. 手动增加内存限制

```bash
# 增加到4GB内存
node --max-old-space-size=4096 server.js

# 增加到8GB内存（如果你有足够RAM）
node --max-old-space-size=8192 server.js

# 启用垃圾回收
node --max-old-space-size=4096 --expose-gc server.js
```

### 3. 设置环境变量

```bash
# Linux/macOS
export NODE_OPTIONS=\"--max-old-space-size=4096 --expose-gc\"
npm run server

# Windows
set NODE_OPTIONS=--max-old-space-size=4096 --expose-gc
npm run server
```

## 🛠️ 优化版本的特性

### rag-agent-optimized.js 改进：

1. **分批处理**: 文档分小批次处理，避免一次性加载过多数据
2. **内存监控**: 实时监控内存使用情况
3. **自动垃圾回收**: 定期触发垃圾回收
4. **错误恢复**: 更好的错误处理和恢复机制
5. **大小限制**: 限制文件大小和文档数量

### server-optimized.js 改进：

1. **请求大小限制**: 限制API请求大小
2. **文件上传限制**: 最大5MB文件，最多10个文件
3. **内存清理中间件**: 请求完成后自动清理
4. **内存监控接口**: `/cleanup` 端点手动清理内存
5. **健康检查增强**: 包含内存使用信息

## 📊 内存监控

### 实时监控内存使用

```bash
# 启动内存监控
npm run memory:monitor

# 检查服务器内存状态
curl http://localhost:3000/health

# 手动触发内存清理
curl -X POST http://localhost:3000/cleanup
```

### 内存使用建议

| 系统RAM | Node.js内存限制 | 建议配置 |
|---------|----------------|----------|
| 4GB     | 2GB            | `--max-old-space-size=2048` |
| 8GB     | 4GB            | `--max-old-space-size=4096` |
| 16GB    | 8GB            | `--max-old-space-size=8192` |
| 32GB+   | 12GB           | `--max-old-space-size=12288` |

## 🔧 配置优化

### 1. 调整批处理大小

在 `rag-agent-optimized.js` 中：

```javascript
// 减少批处理大小（处理较少文档但更稳定）
this.batchSize = 3; // 默认是5

// 减少块大小（减少内存使用）
this.maxChunkSize = 600; // 默认是800

// 减少重叠（进一步节省内存）
this.chunkOverlap = 50; // 默认是100
```

### 2. 环境变量配置

创建 `.env` 文件：

```bash
# 内存优化配置
NODE_OPTIONS=--max-old-space-size=4096 --expose-gc
OPENAI_API_KEY=your_api_key_here

# RAG配置
CHUNK_SIZE=600
CHUNK_OVERLAP=50
BATCH_SIZE=3
MAX_FILE_SIZE=5242880
```

### 3. Docker内存限制

如果使用Docker，在 `docker-compose.yml` 中：

```yaml
services:
  rag-agent:
    build: .
    deploy:
      resources:
        limits:
          memory: 6G  # 给容器6GB内存
        reservations:
          memory: 2G  # 预留2GB内存
    environment:
      - NODE_OPTIONS=--max-old-space-size=4096 --expose-gc
```

## 📝 最佳实践

### 1. 文档处理

- **文件大小**: 单个文件不超过5MB
- **批量上传**: 一次不超过10个文件
- **文档数量**: 批量添加不超过50个文档
- **内容长度**: 单个文档不超过100KB

### 2. 使用建议

```bash
# 启动时就使用优化版本
npm run server:optimized

# 定期检查内存使用
curl http://localhost:3000/health

# 处理大量文档前先清理内存
curl -X POST http://localhost:3000/cleanup

# 分批上传大量文档
# 而不是一次性上传所有文档
```

### 3. 监控和维护

```bash
# 监控脚本
#!/bin/bash
while true; do
    echo \"$(date): Checking memory...\"
    curl -s http://localhost:3000/health | grep -o '\"heapUsed\":\"[^\"]*\"'
    sleep 60
done
```

## 🚀 生产环境部署

### 1. PM2配置

更新 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'chalee-rag-agent',
    script: 'server-optimized.js',
    node_args: '--max-old-space-size=4096 --expose-gc',
    max_memory_restart: '3G',
    instances: 1, // 单实例避免内存竞争
    // ... 其他配置
  }]
};
```

### 2. 系统级优化

```bash
# 增加系统交换空间（临时解决）
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 检查可用内存
free -h
```

## 🔍 故障排除

### 问题诊断

1. **检查可用内存**:
   ```bash
   free -h
   ```

2. **检查Node.js进程内存**:
   ```bash
   ps aux | grep node
   ```

3. **实时监控**:
   ```bash
   npm run memory:monitor
   ```

### 常见解决方案

| 错误症状 | 可能原因 | 解决方案 |
|----------|----------|----------|
| 启动时崩溃 | 内存限制太小 | 增加 `--max-old-space-size` |
| 处理大文件时崩溃 | 文件太大 | 使用优化版本，分批处理 |
| 长时间运行后崩溃 | 内存泄漏 | 定期调用 `/cleanup` 接口 |
| 响应变慢 | 垃圾回收压力 | 启用 `--expose-gc` 参数 |

## 📞 获取帮助

如果问题仍然存在：

1. 查看 [故障排除文档](docs/TROUBLESHOOTING.md)
2. 在 GitHub 上 [创建 Issue](https://github.com/PrettyKing/chalee-rag-agent/issues)
3. 包含以下信息：
   - 系统配置（RAM, CPU）
   - Node.js版本
   - 错误日志
   - 处理的文档数量和大小

---

💡 **记住**: 内存优化版本 (`*-optimized.js`) 专门设计用于处理内存限制问题，建议在生产环境中使用这些版本。