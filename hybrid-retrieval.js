// hybrid-retrieval.js
import { ChromaClient } from 'chromadb';
import { OpenAI } from 'openai';

class HybridRetriever {
    constructor(openai, collection) {
        this.openai = openai;
        this.collection = collection;
        this.alpha = 0.7; // 向量检索权重
        this.beta = 0.3;  // 关键词检索权重
    }

    // 向量检索
    async vectorSearch(query, topK = 10) {
        const queryEmbedding = await this.getEmbedding(query);
        
        const results = await this.collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK * 2 // 获取更多候选
        });

        return results.documents[0].map((doc, index) => ({
            content: doc,
            score: results.distances[0][index],
            type: 'vector',
            metadata: results.metadatas[0][index]
        }));
    }

    // 关键词检索（BM25算法）
    async keywordSearch(query, documents, topK = 10) {
        const queryTerms = this.tokenize(query.toLowerCase());
        const scores = [];

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const docTerms = this.tokenize(doc.content.toLowerCase());
            const score = this.calculateBM25Score(queryTerms, docTerms, documents);
            
            scores.push({
                content: doc.content,
                score: score,
                type: 'keyword',
                metadata: doc.metadata,
                index: i
            });
        }

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    // BM25评分算法
    calculateBM25Score(queryTerms, docTerms, allDocuments, k1 = 1.5, b = 0.75) {
        const docLength = docTerms.length;
        const avgDocLength = allDocuments.reduce((sum, doc) => 
            sum + this.tokenize(doc.content.toLowerCase()).length, 0
        ) / allDocuments.length;

        let score = 0;
        const termFreq = {};
        
        // 计算词频
        docTerms.forEach(term => {
            termFreq[term] = (termFreq[term] || 0) + 1;
        });

        queryTerms.forEach(term => {
            const tf = termFreq[term] || 0;
            const idf = this.calculateIDF(term, allDocuments);
            
            const numerator = tf * (k1 + 1);
            const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
            
            score += idf * (numerator / denominator);
        });

        return score;
    }

    // 计算逆文档频率
    calculateIDF(term, documents) {
        const docsContainingTerm = documents.filter(doc =>
            this.tokenize(doc.content.toLowerCase()).includes(term)
        ).length;

        return Math.log((documents.length - docsContainingTerm + 0.5) / (docsContainingTerm + 0.5));
    }

    // 简单分词
    tokenize(text) {
        return text
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2)
            .filter(token => !this.isStopWord(token));
    }

    // 停用词检查
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
            'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        ]);
        return stopWords.has(word.toLowerCase());
    }

    // 混合检索主函数
    async hybridSearch(query, topK = 5) {
        // 获取所有文档用于关键词检索
        const allResults = await this.collection.get();
        const allDocuments = allResults.documents.map((doc, index) => ({
            content: doc,
            metadata: allResults.metadatas[index]
        }));

        // 并行执行向量检索和关键词检索
        const [vectorResults, keywordResults] = await Promise.all([
            this.vectorSearch(query, topK * 2),
            this.keywordSearch(query, allDocuments, topK * 2)
        ]);

        // 合并和重新排序结果
        const combinedResults = this.combineResults(
            vectorResults, 
            keywordResults, 
            this.alpha, 
            this.beta
        );

        return combinedResults.slice(0, topK);
    }

    // 结果合并算法
    combineResults(vectorResults, keywordResults, alpha, beta) {
        const resultMap = new Map();

        // 处理向量检索结果
        vectorResults.forEach((result, index) => {
            const normalizedScore = 1 / (1 + result.score); // 距离转相似度
            const key = this.getResultKey(result.content);
            
            if (resultMap.has(key)) {
                resultMap.get(key).vectorScore = normalizedScore;
                resultMap.get(key).vectorRank = index + 1;
            } else {
                resultMap.set(key, {
                    content: result.content,
                    metadata: result.metadata,
                    vectorScore: normalizedScore,
                    vectorRank: index + 1,
                    keywordScore: 0,
                    keywordRank: Infinity
                });
            }
        });

        // 处理关键词检索结果
        keywordResults.forEach((result, index) => {
            const key = this.getResultKey(result.content);
            
            if (resultMap.has(key)) {
                resultMap.get(key).keywordScore = result.score;
                resultMap.get(key).keywordRank = index + 1;
            } else {
                resultMap.set(key, {
                    content: result.content,
                    metadata: result.metadata,
                    vectorScore: 0,
                    vectorRank: Infinity,
                    keywordScore: result.score,
                    keywordRank: index + 1
                });
            }
        });

        // 计算组合分数
        const combinedResults = Array.from(resultMap.values()).map(result => {
            // 归一化分数
            const maxVectorScore = Math.max(...Array.from(resultMap.values()).map(r => r.vectorScore));
            const maxKeywordScore = Math.max(...Array.from(resultMap.values()).map(r => r.keywordScore));
            
            const normalizedVectorScore = maxVectorScore > 0 ? result.vectorScore / maxVectorScore : 0;
            const normalizedKeywordScore = maxKeywordScore > 0 ? result.keywordScore / maxKeywordScore : 0;
            
            // 组合分数
            const combinedScore = alpha * normalizedVectorScore + beta * normalizedKeywordScore;
            
            return {
                content: result.content,
                metadata: result.metadata,
                combinedScore: combinedScore,
                vectorScore: result.vectorScore,
                keywordScore: result.keywordScore,
                details: {
                    vectorRank: result.vectorRank,
                    keywordRank: result.keywordRank,
                    alpha: alpha,
                    beta: beta
                }
            };
        });

        return combinedResults.sort((a, b) => b.combinedScore - a.combinedScore);
    }

    // 生成结果唯一键
    getResultKey(content) {
        return content.slice(0, 100); // 使用前100个字符作为唯一标识
    }

    async getEmbedding(text) {
        const response = await this.openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text
        });
        return response.data[0].embedding;
    }

    // 设置检索权重
    setWeights(alpha, beta) {
        if (alpha + beta !== 1) {
            throw new Error('alpha + beta 必须等于 1');
        }
        this.alpha = alpha;
        this.beta = beta;
    }

    // 查询扩展
    async expandQuery(originalQuery) {
        const prompt = `请为以下查询生成3-5个相关的同义词或相关术语，用逗号分隔：

原始查询: ${originalQuery}

相关术语:`;

        const response = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 100
        });

        const expandedTerms = response.choices[0].message.content
            .split(',')
            .map(term => term.trim())
            .filter(term => term.length > 0);

        return [originalQuery, ...expandedTerms].join(' ');
    }

    // 带查询扩展的混合检索
    async expandedHybridSearch(query, topK = 5) {
        const expandedQuery = await this.expandQuery(query);
        console.log(`扩展查询: ${expandedQuery}`);
        
        return this.hybridSearch(expandedQuery, topK);
    }
}