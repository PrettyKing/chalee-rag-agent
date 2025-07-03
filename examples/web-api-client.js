// examples/web-api-client.js
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

/**
 * Web API 客户端示例
 */
class RAGAPIClient {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
    }
    
    // 健康检查
    async healthCheck() {
        const response = await fetch(`${this.baseURL}/health`);
        return await response.json();
    }
    
    // 查询
    async query(question) {
        const response = await fetch(`${this.baseURL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        });
        return await response.json();
    }
    
    // 上传文档
    async uploadDocuments(filePaths) {
        const form = new FormData();
        
        for (const filePath of filePaths) {
            form.append('documents', fs.createReadStream(filePath));
        }
        
        const response = await fetch(`${this.baseURL}/upload`, {
            method: 'POST',
            body: form
        });
        return await response.json();
    }
    
    // 批量添加文档
    async addDocuments(documents) {
        const response = await fetch(`${this.baseURL}/documents/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ documents })
        });
        return await response.json();
    }
    
    // 检索文档
    async retrieve(query, topK = 5) {
        const response = await fetch(`${this.baseURL}/retrieve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, topK })
        });
        return await response.json();
    }
    
    // 获取统计信息
    async getStats() {
        const response = await fetch(`${this.baseURL}/stats`);
        return await response.json();
    }
}

// 使用示例
async function apiExample() {
    console.log('🌐 RAG Web API 客户端示例');
    
    const client = new RAGAPIClient();
    
    try {
        // 1. 健康检查
        console.log('🏥 检查服务器状态...');
        const health = await client.healthCheck();
        console.log('健康状态:', health);
        
        // 2. 添加示例文档
        console.log('\n📚 添加文档...');
        const documents = [
            {
                content: 'JavaScript 是一种高级的、解释型的编程语言，广泛用于 Web 开发。',
                source: 'javascript.txt'
            },
            {
                content: 'Python 是一种简洁、易读的编程语言，在数据科学和 AI 领域非常流行。',
                source: 'python.txt'
            }
        ];
        
        const addResult = await client.addDocuments(documents);
        console.log('添加结果:', addResult);
        
        // 3. 查询示例
        console.log('\n🔍 查询示例...');
        const queries = [
            'JavaScript 有什么特点？',
            'Python 适用于哪些领域？'
        ];
        
        for (const question of queries) {
            console.log(`\n❓ 问题: ${question}`);
            const result = await client.query(question);
            console.log(`💬 回答: ${result.answer}`);
        }
        
        // 4. 检索示例
        console.log('\n🔎 检索示例...');
        const retrieveResult = await client.retrieve('编程语言', 3);
        console.log('检索结果:', retrieveResult);
        
        // 5. 获取统计信息
        console.log('\n📊 获取统计信息...');
        const stats = await client.getStats();
        console.log('统计信息:', stats);
        
    } catch (error) {
        console.error('❌ API 调用失败:', error);
    }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('请确保先启动 RAG Agent 服务器: npm run server');
    console.log('然后再运行此示例\n');
    apiExample();
}

export default RAGAPIClient;