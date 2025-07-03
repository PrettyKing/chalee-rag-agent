// server.js
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import RAGAgent from './rag-agent.js';

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// 全局RAG Agent实例
let ragAgent = null;

// 初始化RAG Agent
async function initializeAgent() {
    ragAgent = new RAGAgent();
    await ragAgent.initialize();
    console.log("RAG Agent 初始化完成");
}

// API路由

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'RAG Agent API is running' });
});

// 查询接口
app.post('/query', async (req, res) => {
    try {
        const { question } = req.body;
        
        if (!question) {
            return res.status(400).json({ 
                error: '请提供问题内容' 
            });
        }
        
        if (!ragAgent) {
            return res.status(503).json({ 
                error: 'RAG Agent 未初始化' 
            });
        }
        
        const answer = await ragAgent.query(question);
        
        res.json({
            question: question,
            answer: answer,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('查询错误:', error);
        res.status(500).json({ 
            error: '查询处理失败',
            details: error.message 
        });
    }
});

// 上传文档接口
app.post('/upload', upload.array('documents'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                error: '请选择要上传的文件' 
            });
        }
        
        if (!ragAgent) {
            return res.status(503).json({ 
                error: 'RAG Agent 未初始化' 
            });
        }
        
        // 处理上传的文件
        const filePaths = req.files.map(file => file.path);
        const documents = await ragAgent.loadDocumentsFromFiles(filePaths);
        
        if (documents.length > 0) {
            await ragAgent.addDocuments(documents);
        }
        
        res.json({
            message: `成功上传并处理 ${documents.length} 个文档`,
            files: req.files.map(f => f.originalname)
        });
        
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({ 
            error: '文档上传处理失败',
            details: error.message 
        });
    }
});

// 获取统计信息
app.get('/stats', async (req, res) => {
    try {
        if (!ragAgent) {
            return res.status(503).json({ 
                error: 'RAG Agent 未初始化' 
            });
        }
        
        const stats = await ragAgent.getStats();
        res.json(stats);
        
    } catch (error) {
        console.error('获取统计信息错误:', error);
        res.status(500).json({ 
            error: '获取统计信息失败',
            details: error.message 
        });
    }
});

// 批量添加文档（从JSON）
app.post('/documents/batch', async (req, res) => {
    try {
        const { documents } = req.body;
        
        if (!documents || !Array.isArray(documents)) {
            return res.status(400).json({ 
                error: '请提供有效的文档数组' 
            });
        }
        
        if (!ragAgent) {
            return res.status(503).json({ 
                error: 'RAG Agent 未初始化' 
            });
        }
        
        await ragAgent.addDocuments(documents);
        
        res.json({
            message: `成功添加 ${documents.length} 个文档`,
            count: documents.length
        });
        
    } catch (error) {
        console.error('批量添加文档错误:', error);
        res.status(500).json({ 
            error: '批量添加文档失败',
            details: error.message 
        });
    }
});

// 检索接口（仅返回相关文档，不生成回答）
app.post('/retrieve', async (req, res) => {
    try {
        const { query, topK = 5 } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                error: '请提供查询内容' 
            });
        }
        
        if (!ragAgent) {
            return res.status(503).json({ 
                error: 'RAG Agent 未初始化' 
            });
        }
        
        const results = await ragAgent.retrieve(query, topK);
        
        res.json({
            query: query,
            results: results,
            count: results.length
        });
        
    } catch (error) {
        console.error('检索错误:', error);
        res.status(500).json({ 
            error: '检索失败',
            details: error.message 
        });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ 
        error: '服务器内部错误',
        details: error.message 
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ 
        error: '接口不存在' 
    });
});

// 启动服务器
async function startServer() {
    try {
        await initializeAgent();
        
        app.listen(port, () => {
            console.log(`RAG Agent API 服务器运行在 http://localhost:${port}`);
            console.log('\n可用接口:');
            console.log('POST /query - 问答查询');
            console.log('POST /upload - 上传文档');
            console.log('POST /documents/batch - 批量添加文档');
            console.log('POST /retrieve - 检索相关文档');
            console.log('GET /stats - 获取统计信息');
            console.log('GET /health - 健康检查');
        });
    } catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
}

startServer();