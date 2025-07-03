// examples/basic-usage.js
import RAGAgent from '../rag-agent.js';

/**
 * 基础使用示例
 */
async function basicExample() {
    console.log('🚀 RAG Agent 基础使用示例');
    
    // 1. 创建 RAG Agent 实例
    const agent = new RAGAgent();
    
    // 2. 初始化
    await agent.initialize();
    console.log('✅ RAG Agent 初始化完成');
    
    // 3. 准备一些示例文档
    const documents = [
        {
            content: `
            Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境。
            它允许开发者在服务器端运行 JavaScript 代码，具有事件驱动、
            非阻塞 I/O 模型等特点，使其轻量且高效。Node.js 广泛用于
            构建可扩展的网络应用程序。
            `,
            source: 'nodejs_intro.txt'
        },
        {
            content: `
            Express.js 是 Node.js 最流行的 Web 应用框架之一。它提供了
            一套强大的功能来开发 Web 和移动应用程序。Express 简化了
            服务器创建过程，提供了中间件支持、路由系统、模板引擎集成等功能。
            `,
            source: 'express_intro.txt'
        },
        {
            content: `
            RESTful API 是一种基于 REST（Representational State Transfer）
            架构风格的应用程序接口。它使用标准的 HTTP 方法（GET、POST、PUT、DELETE）
            来操作资源，具有无状态、可缓存、统一接口等特点，广泛用于 Web 服务开发。
            `,
            source: 'restful_api.txt'
        }
    ];
    
    // 4. 添加文档到向量数据库
    console.log('📚 正在添加文档...');
    await agent.addDocuments(documents);
    console.log('✅ 文档添加完成');
    
    // 5. 查询示例
    const queries = [
        'Node.js 是什么？',
        'Express.js 有什么特点？',
        '什么是 RESTful API？',
        'Node.js 和 Express.js 的关系是什么？'
    ];
    
    console.log('\n🔍 开始查询示例...');
    
    for (const query of queries) {
        console.log(`\n❓ 问题: ${query}`);
        const answer = await agent.query(query);
        console.log(`💬 回答: ${answer}`);
        console.log('-'.repeat(50));
    }
    
    // 6. 获取统计信息
    const stats = await agent.getStats();
    console.log(`\n📊 数据库统计: 共有 ${stats.documentCount} 个文档块`);
}

// 运行示例
basicExample().catch(console.error);