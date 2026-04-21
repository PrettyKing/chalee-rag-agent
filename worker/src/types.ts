// ============ Cloudflare Bindings ============
export interface Env {
  // Workers AI - 嵌入 + LLM
  AI: Ai;

  // Vectorize - 向量数据库
  VECTORIZE: VectorizeIndex;

  // R2 - 文件存储
  R2: R2Bucket;

  // KV - 缓存
  KV: KVNamespace;

  // D1 - 元数据库
  DB: D1Database;

  // 环境变量
  CHUNK_SIZE: string;
  CHUNK_OVERLAP: string;
  TOP_K_RESULTS: string;
  MAX_TOKENS: string;

  // 可选: 使用 OpenAI
  OPENAI_API_KEY?: string;
  USE_OPENAI?: string;
}

// ============ 文档相关 ============
export interface Document {
  content: string;
  source?: string;
  metadata?: Record<string, string | number>;
}

export interface DocumentChunk {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  totalChunks: number;
  docIndex: number;
}

// ============ 向量相关 ============
export interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    text: string;
    source: string;
    chunkIndex: number;
    totalChunks: number;
    docIndex: number;
    createdAt: string;
  };
}

export interface RetrieveResult {
  text: string;
  source: string;
  score: number;
  chunkIndex: number;
}

// ============ API 请求/响应 ============
export interface QueryRequest {
  question: string;
  topK?: number;
  stream?: boolean;
}

export interface QueryResponse {
  question: string;
  answer: string;
  sources: string[];
  processingTime: number;
  timestamp: string;
}

export interface UploadResponse {
  message: string;
  files: string[];
  documentsProcessed: number;
  chunksCreated: number;
  processingTime: number;
}

export interface RetrieveRequest {
  query: string;
  topK?: number;
}

export interface RetrieveResponse {
  query: string;
  results: RetrieveResult[];
  count: number;
}

export interface StatsResponse {
  vectorCount: number;
  r2Objects: number;
  kvKeys: number;
  configuration: {
    chunkSize: number;
    chunkOverlap: number;
    topKResults: number;
    embeddingModel: string;
    llmModel: string;
  };
}

// ============ Workers AI 响应类型 ============
export interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

export interface LLMResponse {
  response: string;
}
