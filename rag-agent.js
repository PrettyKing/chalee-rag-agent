// rag-agent.js
import { OpenAI } from 'openai';
import { ChromaClient } from 'chromadb';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

class RAGAgent {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.chroma = new ChromaClient({ path: "http://localhost:8000" });
        this.collection = null;
        this.collectionName = "documents";
    }

    // 初始化向量数据库
    async initialize() {
        try {
            // 尝试获取现有collection
            this.collection = await this.chroma.getCollection({ 
                name: this.collectionName 
            });
            console.log("使用现有的collection");
        } catch (error) {
            // 创建新collection
            this.collection = await this.chroma.createCollection({ 
                name: this.collectionName 
            });
            console.log("创建新的collection");
        }
    }

    // 文档分块
    splitText(text, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        let start = 0;
        
        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            chunks.push(text.slice(start, end));
            start = end - overlap;
            
            if (start >= text.length) break;
        }
        
        return chunks;
    }

    // 获取文本向量
    async getEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: text
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error("获取向量失败:", error);
            throw error;
        }
    }

    // 批量向量化文档
    async addDocuments(documents) {
        const chunks = [];
        const embeddings = [];
        const ids = [];
        const metadatas = [];

        console.log("开始处理文档...");
        
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const textChunks = this.splitText(doc.content);
            
            for (let j = 0; j < textChunks.length; j++) {
                const chunk = textChunks[j];
                const embedding = await this.getEmbedding(chunk);
                
                chunks.push(chunk);
                embeddings.push(embedding);
                ids.push(`doc_${i}_chunk_${j}`);
                metadatas.push({
                    source: doc.source || `document_${i}`,
                    chunk_index: j,
                    total_chunks: textChunks.length
                });
                
                console.log(`处理进度: ${i + 1}/${documents.length} 文档, ${j + 1}/${textChunks.length} 块`);
            }
        }

        // 批量添加到向量数据库
        await this.collection.add({
            ids: ids,
            embeddings: embeddings,
            documents: chunks,
            metadatas: metadatas
        });

        console.log(`成功添加 ${chunks.length} 个文档块`);
    }

    // 从文件加载文档
    async loadDocumentsFromFiles(filePaths) {
        const documents = [];
        
        for (const filePath of filePaths) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                documents.push({
                    content: content,
                    source: path.basename(filePath)
                });
                console.log(`加载文件: ${filePath}`);
            } catch (error) {
                console.error(`加载文件失败 ${filePath}:`, error);
            }
        }
        
        return documents;
    }

    // 检索相关文档
    async retrieve(query, topK = 5) {
        try {
            const queryEmbedding = await this.getEmbedding(query);
            
            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: topK
            });

            return results.documents[0] || [];
        } catch (error) {
            console.error("检索失败:", error);
            return [];
        }
    }

    // 生成回答
    async generateResponse(query, context) {
        const prompt = `基于以下上下文信息回答问题。如果上下文中没有相关信息，请明确说明。

上下文信息：
${context.map((doc, index) => `[${index + 1}] ${doc}`).join('\n\n')}

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
                max_tokens: 1000
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error("生成回答失败:", error);
            return "抱歉，生成回答时出现错误。";
        }
    }

    // 主要查询方法
    async query(question) {
        console.log(`\n收到问题: ${question}`);
        
        // 检索相关文档
        console.log("正在检索相关信息...");
        const relevantDocs = await this.retrieve(question);
        
        if (relevantDocs.length === 0) {
            return "抱歉，我没有找到相关的信息来回答您的问题。";
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
            return { documentCount: count };
        } catch (error) {
            console.error("获取统计信息失败:", error);
            return { documentCount: 0 };
        }
    }
}

// 使用示例
async function main() {
    const agent = new RAGAgent();
    
    try {
        // 初始化
        await agent.initialize();
        
        // 示例：加载文档（你需要准备一些txt文件）
        const filePaths = [
            './documents/doc1.txt',
            './documents/doc2.txt'
            // 添加更多文件路径
        ];
        
        // 检查是否需要加载文档
        const stats = await agent.getStats();
        if (stats.documentCount === 0) {
            console.log("正在加载文档...");
            const documents = await agent.loadDocumentsFromFiles(filePaths);
            if (documents.length > 0) {
                await agent.addDocuments(documents);
            }
        }
        
        // 交互式查询
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log("\n=== RAG Agent 准备就绪 ===");
        console.log("输入问题开始查询，输入 'quit' 退出\n");
        
        const askQuestion = () => {
            rl.question("问题: ", async (question) => {
                if (question.toLowerCase() === 'quit') {
                    rl.close();
                    return;
                }
                
                const answer = await agent.query(question);
                console.log(`\n回答: ${answer}\n`);
                console.log("-".repeat(50));
                askQuestion();
            });
        };
        
        askQuestion();
        
    } catch (error) {
        console.error("初始化失败:", error);
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default RAGAgent;