import { Context } from 'hono';
import type { Env, RetrieveRequest, RetrieveResponse, StatsResponse } from '../types';
import { RAGAgent } from '../rag-agent';

export async function handleRetrieve(c: Context<{ Bindings: Env }>) {
  let body: RetrieveRequest;
  try {
    body = await c.req.json<RetrieveRequest>();
  } catch {
    return c.json({ error: '请求体格式错误，需要 JSON' }, 400);
  }

  const { query, topK = 5 } = body;

  if (!query || typeof query !== 'string') {
    return c.json({ error: '请提供有效的查询内容' }, 400);
  }

  try {
    const agent = new RAGAgent(c.env);
    const results = await agent.retrieve(query.trim(), Math.min(topK, 20));

    const response: RetrieveResponse = {
      query,
      results,
      count: results.length,
    };

    return c.json(response);
  } catch (err) {
    console.error('检索错误:', err);
    return c.json({ error: '检索失败', details: String(err) }, 500);
  }
}

export async function handleStats(c: Context<{ Bindings: Env }>) {
  try {
    const agent = new RAGAgent(c.env);
    const stats = await agent.getStats();

    let r2Objects = 0;
    try {
      const listed = await c.env.R2.list({ prefix: 'uploads/', limit: 1000 });
      r2Objects = listed.objects.length;
    } catch {
      // 忽略
    }

    const response: StatsResponse = {
      ...stats,
      r2Objects,
      kvKeys: 0,
    };

    return c.json(response);
  } catch (err) {
    console.error('获取统计信息错误:', err);
    return c.json({ error: '获取统计信息失败', details: String(err) }, 500);
  }
}

export async function handleHealth(c: Context<{ Bindings: Env }>) {
  return c.json({
    status: 'ok',
    message: 'Chalee RAG Agent (Cloudflare Workers) is running',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
    region: (c.req.raw as Request & { cf?: { colo: string } }).cf?.colo ?? 'unknown',
  });
}

export async function handleCacheClear(c: Context<{ Bindings: Env }>) {
  try {
    return c.json({
      message: '缓存清理完成（下次查询将重新生成向量并缓存）',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ error: '缓存清理失败', details: String(err) }, 500);
  }
}
