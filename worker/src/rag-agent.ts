/**
 * RAG Agent 核心逻辑
 *
 * 迁移对照：
 *   原项目                      →  Cloudflare
 *   ─────────────────────────────────────────
 *   ChromaClient                →  env.VECTORIZE
 *   openai.embeddings.create    →  env.AI.run('@cf/baai/bge-base-en-v1.5')
 *   openai.chat.completions     →  env.AI.run('@cf/meta/llama-3.1-8b-instruct')
 *   fs.readFile / uploads/      →  env.R2
 *   node-cache                  →  env.KV
 */

import { splitText, preprocessText } from './chunker';
import type {
  Env,
  Document,
  RetrieveResult,
  EmbeddingResponse,
  LLMResponse,
} from './types';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const CACHE_TTL = 60 * 60;

export class RAGAgent {
  private env: Env;
  private chunkSize: number;
  private chunkOverlap: number;
  private topK: number;

  constructor(env: Env) {
    this.env = env;
    this.chunkSize = parseInt(env.CHUNK_SIZE ?? '800');
    this.chunkOverlap = parseInt(env.CHUNK_OVERLAP ?? '100');
    this.topK = parseInt(env.TOP_K_RESULTS ?? '5');
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (this.env.USE_OPENAI === 'true' && this.env.OPENAI_API_KEY) {
      return this.getOpenAIEmbedding(text);
    }
    const input = text.slice(0, 8000);
    const result = await this.env.AI.run(EMBEDDING_MODEL, {
      text: [input],
    }) as EmbeddingResponse;
    return result.data[0];
  }

  private async getOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text.slice(0, 8000),
      }),
    });
    if (!response.ok) throw new Error(`OpenAI embedding failed: ${response.status}`);
    const data = await response.json() as { data: { embedding: number[] }[] };
    return data.data[0].embedding;
  }

  async addDocuments(documents: Document[]): Promise<{ chunksCreated: number }> {
    if (!documents || documents.length === 0) throw new Error('没有提供文档');

    console.log(`开始处理 ${documents.length} 个文档...`);
    let totalChunks = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const vectors: VectorizeVector[] = [];

      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const docIndex = i + j;

        if (!doc.content?.trim()) {
          console.warn(`文档 ${docIndex} 内容为空，跳过`);
          continue;
        }

        const processedText = preprocessText(doc.content, doc.source ?? 'unknown');
        const chunks = splitText(processedText, {
          chunkSize: this.chunkSize,
          overlap: this.chunkOverlap,
        });

        console.log(`文档 ${docIndex + 1} (${doc.source}): 切割为 ${chunks.length} 块`);

        for (let k = 0; k < chunks.length; k++) {
          try {
            const embedding = await this.getEmbedding(chunks[k]);
            vectors.push({
              id: `doc_${docIndex}_chunk_${k}_${Date.now()}`,
              values: embedding,
              metadata: {
                text: chunks[k],
                source: doc.source ?? `document_${docIndex}`,
                chunkIndex: k,
                totalChunks: chunks.length,
                docIndex,
                createdAt: new Date().toISOString(),
              },
            });
            totalChunks++;
          } catch (err) {
            console.error(`文档 ${docIndex} 块 ${k} 向量化失败:`, err);
          }
        }
      }

      if (vectors.length > 0) {
        await this.env.VECTORIZE.insert(vectors);
        console.log(`批次 ${Math.floor(i / BATCH_SIZE) + 1}: 写入 ${vectors.length} 条向量`);
      }
    }

    console.log(`处理完成，共创建 ${totalChunks} 个向量块`);
    return { chunksCreated: totalChunks };
  }

  async retrieve(query: string, topK?: number): Promise<RetrieveResult[]> {
    if (!query?.trim()) return [];

    const k = Math.min(topK ?? this.topK, 20);
    const cacheKey = `retrieve:${btoa(encodeURIComponent(query)).slice(0, 64)}:${k}`;
    const cached = await this.env.KV.get(cacheKey, 'json');
    if (cached) {
      console.log('命中缓存:', cacheKey);
      return cached as RetrieveResult[];
    }

    const queryEmbedding = await this.getEmbedding(query.trim());
    const queryResult = await this.env.VECTORIZE.query(queryEmbedding, {
      topK: k,
      returnMetadata: 'all',
    });

    const results: RetrieveResult[] = queryResult.matches
      .filter(m => m.score > 0.3)
      .map(m => ({
        text: (m.metadata?.text as string) ?? '',
        source: (m.metadata?.source as string) ?? 'unknown',
        score: m.score,
        chunkIndex: (m.metadata?.chunkIndex as number) ?? 0,
      }));

    await this.env.KV.put(cacheKey, JSON.stringify(results), {
      expirationTtl: CACHE_TTL,
    });

    return results;
  }

  async generateResponse(query: string, context: RetrieveResult[]): Promise<string> {
    if (this.env.USE_OPENAI === 'true' && this.env.OPENAI_API_KEY) {
      return this.generateOpenAIResponse(query, context);
    }

    const contextText = context
      .slice(0, 5)
      .map((doc, i) => `[${i + 1}] (来源: ${doc.source})\n${doc.text}`)
      .join('\n\n')
      .slice(0, 3000);

    const messages: RoleScopedChatInput[] = [
      {
        role: 'system',
        content: '你是一个专业的知识库助手。请基于提供的上下文信息准确回答问题。如果上下文中没有相关信息，请明确说明。回答要简洁、准确。',
      },
      {
        role: 'user',
        content: `上下文信息：\n${contextText}\n\n问题：${query}\n\n请基于上下文回答：`,
      },
    ];

    const result = await this.env.AI.run(LLM_MODEL, {
      messages,
      max_tokens: parseInt(this.env.MAX_TOKENS ?? '800'),
      temperature: 0.7,
    }) as LLMResponse;

    return result.response ?? '抱歉，生成回答时出现错误。';
  }

  private async generateOpenAIResponse(query: string, context: RetrieveResult[]): Promise<string> {
    const contextText = context
      .slice(0, 5)
      .map((doc, i) => `[${i + 1}] ${doc.text}`)
      .join('\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '你是一个有用的AI助手。基于提供的上下文信息准确回答问题。' },
          { role: 'user', content: `上下文：\n${contextText.slice(0, 3000)}\n\n问题：${query}` },
        ],
        temperature: 0.7,
        max_tokens: parseInt(this.env.MAX_TOKENS ?? '800'),
      }),
    });

    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }

  async query(question: string, topK?: number): Promise<{ answer: string; sources: string[] }> {
    if (!question?.trim()) {
      return { answer: '请提供有效的问题。', sources: [] };
    }

    console.log(`收到问题: ${question.slice(0, 50)}...`);
    const relevantDocs = await this.retrieve(question.trim(), topK);

    if (relevantDocs.length === 0) {
      return {
        answer: '抱歉，知识库中没有找到相关信息。请先上传相关文档，或尝试换个问法。',
        sources: [],
      };
    }

    console.log(`找到 ${relevantDocs.length} 个相关块，开始生成回答...`);
    const answer = await this.generateResponse(question, relevantDocs);
    const sources = [...new Set(relevantDocs.map(d => d.source))];

    return { answer, sources };
  }

  async loadDocumentsFromR2(keys: string[]): Promise<Document[]> {
    const documents: Document[] = [];

    for (const key of keys) {
      try {
        const object = await this.env.R2.get(key);
        if (!object) {
          console.warn(`R2 对象不存在: ${key}`);
          continue;
        }
        const content = await object.text();
        if (!content.trim()) {
          console.warn(`文件 ${key} 内容为空，跳过`);
          continue;
        }
        documents.push({
          content,
          source: key.split('/').pop() ?? key,
        });
        console.log(`加载 R2 文件: ${key} (${content.length} 字符)`);
      } catch (err) {
        console.error(`加载 R2 文件失败 ${key}:`, err);
      }
    }

    return documents;
  }

  async getStats() {
    let vectorCount = 0;
    try {
      const result = await this.env.DB
        .prepare('SELECT COUNT(*) as count FROM document_chunks')
        .first<{ count: number }>();
      vectorCount = result?.count ?? 0;
    } catch {
      // D1 表可能还未初始化
    }

    return {
      vectorCount,
      configuration: {
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        topKResults: this.topK,
        embeddingModel: this.env.USE_OPENAI === 'true' ? 'text-embedding-ada-002' : EMBEDDING_MODEL,
        llmModel: this.env.USE_OPENAI === 'true' ? 'gpt-3.5-turbo' : LLM_MODEL,
      },
    };
  }
}
