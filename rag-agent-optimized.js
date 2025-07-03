// rag-agent-optimized.js
import { OpenAI } from 'openai';
import { ChromaClient } from 'chromadb';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

class OptimizedRAGAgent {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.chroma = new ChromaClient({ path: "http://localhost:8000" });
        this.collection = null;
        this.collectionName = "documents";
        
        // 内存优化配置
        this.batchSize = 5; // 减小批处理大小
        this.maxChunkSize = 800; // 减小块大小
        this.chunkOverlap = 100; // 减小重叠
    }

    // 初始化向量数据库
    async initialize() {
        try {
            this.collection = await this.chroma.getCollection({ 
                name: this.collectionName 
            });
            console.log("使用现有的collection");
        } catch (error) {
            this.collection = await this.chroma.createCollection({ 
                name: this.collectionName 
            });
            console.log("创建新的collection");
        }
    }

    // 文档分块 - 优化内存使用
    splitText(text, chunkSize = this.maxChunkSize, overlap = this.chunkOverlap) {
        if (!text || text.length === 0) return [];
        
        const chunks = [];
        let start = 0;
        
        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            const chunk = text.slice(start, end).trim();
            
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
            
            start = end - overlap;
            if (start >= text.length) break;
        }
        
        return chunks;
    }

    // 获取文本向量 - 添加重试机制
    async getEmbedding(text, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await this.openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: text.substring(0, 8000) // 限制输入长度
                });
                return response.data[0].embedding;
            } catch (error) {
                console.error(`向量化失败 (尝试 ${attempt}/${retries}):`, error.message);
                
                if (error.status === 429 && attempt < retries) {
                    // 速率限制，等待后重试
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                    continue;
                }
                
                if (attempt === retries) {
                    throw error;
                }
            }
        }
    }

    // 批量向量化文档 - 内存优化版本
    async addDocuments(documents) {
        if (!documents || documents.length === 0) {
            throw new Error("没有提供文档");
        }

        console.log(`开始处理 ${documents.length} 个文档...`);
        let totalProcessed = 0;

        // 分批处理文档以避免内存溢出
        for (let i = 0; i < documents.length; i += this.batchSize) {
            const batch = documents.slice(i, i + this.batchSize);
            console.log(`处理批次 ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(documents.length/this.batchSize)}`);
            
            await this.processBatch(batch, i);
            totalProcessed += batch.length;
            
            // 强制垃圾回收（如果启用）
            if (global.gc) {
                global.gc();
            }
            
            // 短暂延迟以减少内存压力
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`成功处理 ${totalProcessed} 个文档`);
    }

    // 处理单个批次
    async processBatch(batch, baseIndex) {
        const chunks = [];
        const embeddings = [];
        const ids = [];
        const metadatas = [];

        for (let i = 0; i < batch.length; i++) {
            const doc = batch[i];
            const docIndex = baseIndex + i;
            
            if (!doc.content) {
                console.warn(`文档 ${docIndex} 没有内容，跳过`);
                continue;
            }

            const textChunks = this.splitText(doc.content);
            console.log(`文档 ${docIndex + 1}: 分割为 ${textChunks.length} 个块`);

            for (let j = 0; j < textChunks.length; j++) {
                try {
                    const chunk = textChunks[j];
                    const embedding = await this.getEmbedding(chunk);
                    
                    chunks.push(chunk);
                    embeddings.push(embedding);
                    ids.push(`doc_${docIndex}_chunk_${j}`);
                    metadatas.push({
                        source: doc.source || `document_${docIndex}`,
                        chunk_index: j,
                        total_chunks: textChunks.length,
                        doc_index: docIndex
                    });
                    
                    // 打印进度
                    if (j % 5 === 0 || j === textChunks.length - 1) {
                        console.log(`  块 ${j + 1}/${textChunks.length} 处理完成`);
                    }
                } catch (error) {
                    console.error(`处理文档 ${docIndex} 块 ${j} 失败:`, error.message);
                    // 继续处理其他块，不中断整个过程
                }
            }
        }

        // 批量添加到向量数据库
        if (chunks.length > 0) {
            try {
                await this.collection.add({
                    ids: ids,
                    embeddings: embeddings,
                    documents: chunks,
                    metadatas: metadatas
                });
                console.log(`批次添加成功: ${chunks.length} 个块`);
            } catch (error) {
                console.error("批次添加失败:", error);
                throw error;
            }
        }
    }

    // 从文件加载文档 - 添加大小检查
    async loadDocumentsFromFiles(filePaths) {
        const documents = [];
        const maxFileSize = 5 * 1024 * 1024; // 5MB限制
        
        for (const filePath of filePaths) {
            try {
                const stats = await fs.stat(filePath);
                
                if (stats.size > maxFileSize) {
                    console.warn(`文件 ${filePath} 太大 (${(stats.size/1024/1024).toFixed(2)}MB)，跳过`);
                    continue;
                }
                
                const content = await fs.readFile(filePath, 'utf-8');
                
                if (content.trim().length === 0) {
                    console.warn(`文件 ${filePath} 为空，跳过`);
                    continue;
                }
                
                documents.push({
                    content: content,
                    source: path.basename(filePath)
                });
                console.log(`加载文件: ${filePath} (${(stats.size/1024).toFixed(1)}KB)`);
            } catch (error) {
                console.error(`加载文件失败 ${filePath}:`, error.message);
            }
        }
        
        return documents;
    }

    // 检索相关文档
    async retrieve(query, topK = 5) {
        try {
            if (!query || query.trim().length === 0) {
                return [];
            }
            
            const queryEmbedding = await this.getEmbedding(query.trim());
            
            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: Math.min(topK, 10) // 限制最大返回数量
            });

            return results.documents[0] || [];
        } catch (error) {
            console.error("检索失败:", error);
            return [];
        }
    }

    // 生成回答 - 优化token使用
    async generateResponse(query, context) {
        // 限制上下文长度以避免token限制
        const maxContextLength = 3000;
        let truncatedContext = context;
        
        const contextText = context.join('\n\n');
        if (contextText.length > maxContextLength) {
            // 截断上下文，保留最相关的部分
            truncatedContext = context.slice(0, Math.min(3, context.length));
        }

        const prompt = `基于以下上下文信息回答问题。如果上下文中没有相关信息，请明确说明。

上下文信息：
${truncatedContext.map((doc, index) => `[${index + 1}] ${doc}`).join('\n\n')}

问题：${query}

请提供准确、有用的回答：`;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "你是一个有用的AI助手。基于提供的上下文信息准确回答问题。"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 800 // 减少最大token数
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error("生成回答失败:", error);
            return "抱歉，生成回答时出现错误。请稍后再试。";
        }
    }

    // 主要查询方法
    async query(question) {
        console.log(`\n收到问题: ${question}`);
        
        if (!question || question.trim().length === 0) {
            return "请提供有效的问题。";
        }
        
        // 检索相关文档
        console.log("正在检索相关信息...");
        const relevantDocs = await this.retrieve(question.trim());
        
        if (relevantDocs.length === 0) {
            return "抱歉，我没有找到相关的信息来回答您的问题。请尝试添加更多文档或换个问法。";
        }

        console.log(`找到 ${relevantDocs.length} 个相关文档片段`);
        
        // 生成回答
        console.log("正在生成回答...");
        const response = await this.generateResponse(question, relevantDocs);
        
        return response;
    }

    // 获取集合统计信息
    async getStats() {
        try {
            const count = await this.collection.count();
            return { 
                documentCount: count,
                memoryUsage: process.memoryUsage(),
                configuration: {
                    batchSize: this.batchSize,
                    maxChunkSize: this.maxChunkSize,
                    chunkOverlap: this.chunkOverlap
                }
            };
        } catch (error) {
            console.error("获取统计信息失败:", error);
            return { documentCount: 0 };
        }
    }

    // 清理资源
    async cleanup() {
        console.log("清理资源...");
        // 强制垃圾回收
        if (global.gc) {
            global.gc();
        }
    }
}

export default OptimizedRAGAgent;