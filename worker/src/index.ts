/**
 * Chalee RAG Agent — Cloudflare Workers 入口
 *
 * 原项目: Express.js (server.js) + Node.js
 * 迁移后: Hono + Cloudflare Workers
 *
 * API 路由对照：
 *   POST /query               → handleQuery        (智能问答)
 *   POST /query/stream        → handleQueryStream  (流式问答，新增)
 *   POST /upload              → handleUpload       (上传文档)
 *   POST /documents/batch     → handleBatchDocuments (批量添加)
 *   POST /retrieve            → handleRetrieve     (检索文档)
 *   GET  /stats               → handleStats        (统计信息)
 *   GET  /health              → handleHealth       (健康检查)
 *   POST /cache/clear         → handleCacheClear   (清理缓存)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { rateLimiter } from 'hono-rate-limiter';

import type { Env } from './types';
import { handleQuery, handleQueryStream } from './routes/query';
import { handleUpload, handleBatchDocuments } from './routes/upload';
import { handleRetrieve, handleStats, handleHealth, handleCacheClear } from './routes/retrieve';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.use('*', logger());
app.use('*', prettyJSON());

app.use('*', rateLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (c) => {
    return c.req.header('CF-Connecting-IP')
      ?? c.req.header('X-Forwarded-For')
      ?? 'unknown';
  },
}));

app.get('/health', handleHealth);
app.post('/query', handleQuery);
app.post('/query/stream', handleQueryStream);
app.post('/upload', handleUpload);
app.post('/documents/batch', handleBatchDocuments);
app.post('/retrieve', handleRetrieve);
app.get('/stats', handleStats);
app.post('/cache/clear', handleCacheClear);

app.get('/', (c) => {
  return c.json({
    name: 'Chalee RAG Agent',
    version: '2.0.0',
    runtime: 'Cloudflare Workers',
    endpoints: [
      'POST /query          — 智能问答',
      'POST /query/stream   — 流式问答 (SSE)',
      'POST /upload         — 上传文档 (multipart)',
      'POST /documents/batch — 批量添加文档 (JSON)',
      'POST /retrieve       — 检索相关片段',
      'GET  /stats          — 统计信息',
      'GET  /health         — 健康检查',
      'POST /cache/clear    — 清理缓存',
    ],
  });
});

app.notFound((c) => c.json({ error: '接口不存在' }, 404));

app.onError((err, c) => {
  console.error('未捕获错误:', err);
  return c.json({ error: '服务器内部错误', details: err.message }, 500);
});

export default app;
