// test.js
import RAGAgent from './rag-agent.js';
import fs from 'fs/promises';
import path from 'path';

// 简单测试脚本
async function runTests() {
    console.log('🧪 开始测试 RAG Agent...');
    
    try {
        // 创建测试文档
        const testDocuments = [
            {
                content: `人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，
                旨在创造能够执行通常需要人类智能的任务的机器。这包括学习、推理、
                感知、语言理解和问题解决等能力。AI技术正在快速发展，
                并在各个领域产生深远影响。`,
                source: 'ai_definition.txt'
            },
            {
                content: `机器学习是人工智能的一个重要子领域，它使计算机能够在没有
                明确编程的情况下学习和改进。机器学习算法通过分析大量数据来
                识别模式，并使用这些模式来预测或决策。常见的机器学习类型包括
                监督学习、无监督学习和强化学习。`,
                source: 'machine_learning.txt'
            },
            {
                content: `深度学习是机器学习的一个子集，它使用人工神经网络来模拟
                人脑的工作方式。深度学习在图像识别、自然语言处理、语音识别
                等领域取得了突破性进展。深度神经网络由多个隐藏层组成，
                能够学习复杂的数据表示。`,
                source: 'deep_learning.txt'
            }
        ];
        
        // 初始化 RAG Agent
        const agent = new RAGAgent();
        await agent.initialize();
        console.log('✅ RAG Agent 初始化成功');
        
        // 添加测试文档
        console.log('📚 添加测试文档...');
        await agent.addDocuments(testDocuments);
        console.log('✅ 测试文档添加成功');
        
        // 获取统计信息
        const stats = await agent.getStats();
        console.log('📊 文档统计:', stats);
        
        // 测试查询
        const testQueries = [
            '什么是人工智能？',
            '机器学习有哪些类型？',
            '深度学习的特点是什么？',
            '神经网络是如何工作的？'
        ];
        
        console.log('\n🔍 开始测试查询...');
        
        for (const query of testQueries) {
            console.log(`\n❓ 问题: ${query}`);
            
            // 测试检索
            const relevantDocs = await agent.retrieve(query, 3);
            console.log(`📄 检索到 ${relevantDocs.length} 个相关文档片段`);
            
            // 测试完整查询
            const answer = await agent.query(query);
            console.log(`💬 回答: ${answer.substring(0, 100)}...`);
            
            console.log('---'.repeat(20));
        }
        
        console.log('\n🎉 所有测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests();
}