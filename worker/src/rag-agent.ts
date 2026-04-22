/**
 * RAG Agent 核心逻辑
 *
 * query 支持三种模式：
 *   rag       - 知识库有数据 + AI 总结优化
 *   direct    - 知识库无数据 + AI 直接回答
 *   kb_only   - AI 关闭，只返回知识库原始片段
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

export type QueryMode = 'rag' | 'direct' | 'kb_only';

export interface QueryOptions {
  topK?: number;
  aiEnabled?: boolean;   // 是否开启 AI 增强
  apiKey?: string;       // 用户自带的 API Key（优先级高于 env）
  model?: string;        // 用户指定模型，默认 gpt-3.5-turbo / Workers AI
}

export interface QueryResult {
  answer: string;
  sources: string[];
  mode: QueryMode;       // 告诉前端本次用了哪个模式
}

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

  // ─── 嵌入 ────────────────────────────────
  async getEmbedding(text: string, apiKey?: string): Promise<number[]> {
    const key = apiKey || (this.env.USE_OPENAI === 'true' ? this.env.OPENAI_API_KEY : null);
    if (key) return this.getOpenAIEmbedding(text, key);

    const result = await this.env.AI.run(EMBEDDING_MODEL, {
      text: [text.slice(0, 8000)],
    }) as EmbeddingResponse;
    return result.data[0];
  }

  private async getOpenAIEmbedding(text: string, apiKey: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-ada-002', input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`OpenAI embedding failed: ${res.status}`);
    const data = await res.json() as { data: { embedding: number[] }[] };
    return data.data[0].embedding;
  }

  // ─── 文档入库 ─────────────────────────────
  async addDocuments(documents: Document[]): Promise<{ chunksCreated: number }> {
    if (!documents?.length) throw new Error('没有提供文档');

    let totalChunks = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const vectors: VectorizeVector[] = [];

      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const docIndex = i + j;
        if (!doc.content?.trim()) continue;

        const chunks = splitText(preprocessText(doc.content, doc.source ?? 'unknown'), {
          chunkSize: this.chunkSize,
          overlap: this.chunkOverlap,
        });

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
            console.error(`向量化失败 doc=${docIndex} chunk=${k}:`, err);
          }
        }
      }

      if (vectors.length > 0) {
        await this.env.VECTORIZE.insert(vectors);
      }
    }

    return { chunksCreated: totalChunks };
  }

  // ─── 检索 ─────────────────────────────────
  async retrieve(query: string, topK?: number, apiKey?: string): Promise<RetrieveResult[]> {
    if (!query?.trim()) return [];

    const k = Math.min(topK ?? this.topK, 20);
    const cacheKey = `retrieve:${btoa(encodeURIComponent(query)).slice(0, 64)}:${k}`;
    const cached = await this.env.KV.get(cacheKey, 'json');
    if (cached) return cached as RetrieveResult[];

    const queryEmbedding = await this.getEmbedding(query.trim(), apiKey);
    const result = await this.env.VECTORIZE.query(queryEmbedding, {
      topK: k,
      returnMetadata: 'all',
    });

    const results: RetrieveResult[] = result.matches
      .filter(m => m.score > 0.3)
      .map(m => ({
        text: (m.metadata?.text as string) ?? '',
        source: (m.metadata?.source as string) ?? 'unknown',
        score: m.score,
        chunkIndex: (m.metadata?.chunkIndex as number) ?? 0,
      }));

    await this.env.KV.put(cacheKey, JSON.stringify(results), { expirationTtl: CACHE_TTL });
    return results;
  }

  // ─── AI 生成：基于 KB 上下文 ───────────────
  private async generateWithContext(
    query: string,
    context: RetrieveResult[],
    apiKey?: string,
    model?: string,
  ): Promise<string> {
    const contextText = context
      .slice(0, 5)
      .map((doc, i) => `[${i + 1}] (来源: ${doc.source})\n${doc.text}`)
      .join('\n\n')
      .slice(0, 3000);

    const resolvedKey = apiKey || (this.env.USE_OPENAI === 'true' ? this.env.OPENAI_API_KEY : null);

    if (resolvedKey) {
      return this.callOpenAI(
        [
          { role: 'system', content: '你是一个专业的知识库助手。请基于提供的上下文信息准确、简洁地回答问题，并在适当时候指出信息来源。' },
          { role: 'user', content: `上下文信息：\n${contextText}\n\n问题：${query}\n\n请基于上下文回答：` },
        ],
        resolvedKey,
        model,
      );
    }

    // Workers AI 兜底
    const result = await this.env.AI.run(LLM_MODEL, {
      messages: [
        { role: 'system', content: '你是一个专业的知识库助手。请基于提供的上下文信息准确回答问题。' },
        { role: 'user', content: `上下文信息：\n${contextText}\n\n问题：${query}` },
      ],
      max_tokens: parseInt(this.env.MAX_TOKENS ?? '800'),
      temperature: 0.7,
    }) as LLMResponse;
    return result.response ?? '生成回答时出错。';
  }

  // ─── AI 生成：直接回答（无 KB 上下文）──────
  private async generateDirect(
    query: string,
    apiKey?: string,
    model?: string,
  ): Promise<string> {
    const resolvedKey = apiKey || (this.env.USE_OPENAI === 'true' ? this.env.OPENAI_API_KEY : null);

    if (resolvedKey) {
      return this.callOpenAI(
        [
          { role: 'system', content: '你是一个智能助手，请直接、准确地回答用户问题。' },
          { role: 'user', content: query },
        ],
        resolvedKey,
        model,
      );
    }

    const result = await this.env.AI.run(LLM_MODEL, {
      messages: [
        { role: 'system', content: '你是一个智能助手，请直接、准确地回答用户问题。' },
        { role: 'user', content: query },
      ],
      max_tokens: parseInt(this.env.MAX_TOKENS ?? '800'),
      temperature: 0.7,
    }) as LLMResponse;
    return result.response ?? '生成回答时出错。';
  }

  // ─── OpenAI 通用调用 ──────────────────────
  private async callOpenAI(
    messages: { role: string; content: string }[],
    apiKey: string,
    model?: string,
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: parseInt(this.env.MAX_TOKENS ?? '800'),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API 错误 ${res.status}: ${err}`);
    }
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }

  // ─── 主查询入口 ───────────────────────────
  async query(question: string, options: QueryOptions = {}): Promise<QueryResult> {
    const { topK, aiEnabled = false, apiKey, model } = options;

    if (!question?.trim()) {
      return { answer: '请提供有效的问题。', sources: [], mode: 'kb_only' };
    }

    // 1. 先从知识库检索
    const docs = await this.retrieve(question.trim(), topK, apiKey);

    // 2. AI 关闭 → 只返回原始知识库片段
    if (!aiEnabled) {
      if (!docs.length) {
        return {
          answer: '知识库中未找到相关内容。如需 AI 直接回答，请在设置中开启「AI 增强回答」。',
          sources: [],
          mode: 'kb_only',
        };
      }
      const answer = docs
        .slice(0, 5)
        .map((d, i) => `**[${i + 1}] 来源：${d.source}**（相似度 ${(d.score * 100).toFixed(1)}%）\n${d.text}`)
        .join('\n\n---\n\n');
      return { answer, sources: [...new Set(docs.map(d => d.source))], mode: 'kb_only' };
    }

    // 3. AI 开启 + 知识库有数据 → RAG 模式
    if (docs.length > 0) {
      const answer = await this.generateWithContext(question, docs, apiKey, model);
      return { answer, sources: [...new Set(docs.map(d => d.source))], mode: 'rag' };
    }

    // 4. AI 开启 + 知识库无数据 → 直接问 AI
    const answer = await this.generateDirect(question, apiKey, model);
    return { answer, sources: [], mode: 'direct' };
  }

  // ─── R2 文件加载 ──────────────────────────
  async loadDocumentsFromR2(keys: string[]): Promise<Document[]> {
    const documents: Document[] = [];
    for (const key of keys) {
      try {
        const object = await this.env.R2.get(key);
        if (!object) continue;
        const content = await object.text();
        if (!content.trim()) continue;
        documents.push({ content, source: key.split('/').pop() ?? key });
      } catch (err) {
        console.error(`加载 R2 文件失败 ${key}:`, err);
      }
    }
    return documents;
  }

  // ─── 统计 ─────────────────────────────────
  async getStats() {
    let vectorCount = 0;
    try {
      const result = await this.env.DB
        .prepare('SELECT COUNT(*) as count FROM document_chunks')
        .first<{ count: number }>();
      vectorCount = result?.count ?? 0;
    } catch { /* D1 表可能未初始化 */ }

    return {
      vectorCount,
      configuration: {
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        topKResults: this.topK,
        embeddingModel: EMBEDDING_MODEL,
        llmModel: LLM_MODEL,
      },
    };
  }

  // 保留旧方法签名兼容性
  async generateResponse(query: string, context: RetrieveResult[]): Promise<string> {
    return this.generateWithContext(query, context);
  }
}
