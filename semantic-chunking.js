// semantic-chunking.js
import { OpenAI } from 'openai';

class SemanticChunker {
    constructor(openai) {
        this.openai = openai;
        this.similarityThreshold = 0.7;
    }

    // 计算两个文本的相似度
    async calculateSimilarity(text1, text2) {
        const [emb1, emb2] = await Promise.all([
            this.getEmbedding(text1),
            this.getEmbedding(text2)
        ]);
        
        return this.cosineSimilarity(emb1, emb2);
    }

    // 余弦相似度计算
    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async getEmbedding(text) {
        const response = await this.openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text
        });
        return response.data[0].embedding;
    }

    // 基于语义的智能分块
    async semanticSplit(text, maxChunkSize = 1000) {
        // 首先按段落分割
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        
        if (paragraphs.length <= 1) {
            return this.fallbackSplit(text, maxChunkSize);
        }

        const chunks = [];
        let currentChunk = paragraphs[0];

        for (let i = 1; i < paragraphs.length; i++) {
            const candidate = currentChunk + '\n\n' + paragraphs[i];
            
            // 检查长度限制
            if (candidate.length > maxChunkSize) {
                // 检查语义相似度
                const similarity = await this.calculateSimilarity(
                    currentChunk.slice(-200), // 当前块的末尾
                    paragraphs[i].slice(0, 200) // 下一段的开头
                );
                
                if (similarity < this.similarityThreshold) {
                    // 语义不相关，结束当前块
                    chunks.push(currentChunk.trim());
                    currentChunk = paragraphs[i];
                } else {
                    // 语义相关但太长，强制分割
                    chunks.push(currentChunk.trim());
                    currentChunk = paragraphs[i];
                }
            } else {
                // 长度允许，继续合并
                currentChunk = candidate;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }

    // 备用的固定长度分割
    fallbackSplit(text, chunkSize) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
    }

    // 基于句子的分块（更精细）
    async sentenceBasedSplit(text, maxChunkSize = 1000) {
        // 简单的句子分割（可以使用更复杂的NLP库）
        const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
        
        const chunks = [];
        let currentChunk = '';
        let chunkSentences = [];

        for (const sentence of sentences) {
            const candidate = currentChunk + sentence;
            
            if (candidate.length > maxChunkSize && currentChunk) {
                // 检查是否需要保持语义连贯性
                if (chunkSentences.length > 1) {
                    const similarity = await this.calculateSimilarity(
                        chunkSentences[chunkSentences.length - 1],
                        sentence
                    );
                    
                    if (similarity > this.similarityThreshold) {
                        // 语义相关，尝试压缩当前块
                        chunks.push(currentChunk.trim());
                        currentChunk = sentence;
                        chunkSentences = [sentence];
                    } else {
                        // 语义不相关，正常分割
                        chunks.push(currentChunk.trim());
                        currentChunk = sentence;
                        chunkSentences = [sentence];
                    }
                } else {
                    chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                    chunkSentences = [sentence];
                }
            } else {
                currentChunk = candidate;
                chunkSentences.push(sentence);
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }
}