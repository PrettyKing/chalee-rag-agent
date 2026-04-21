import { Context } from 'hono';
import type { Env, QueryRequest, QueryResponse } from '../types';
import { RAGAgent } from '../rag-agent';

/**
 * POST /query
 * 原 server.js: app.post('/query', ...) 迁移
 */
export async function handleQuery(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now();

  let body: QueryRequest;
  try {
    body = await c.req.json<QueryRequest>();
  } catch {
    return c.json({ error: '请求体格式错误，需要 JSON' }, 400);
  }

  const { question, topK } = body;

  if (!question || typeof question !== 'string') {
    return c.json({ error: '请提供有效的问题内容' }, 400);
  }
  if (question.length > 1000) {
    return c.json({ error: '问题长度不能超过 1000 字符' }, 400);
  }

  try {
    const agent = new RAGAgent(c.env);
    const { answer, sources } = await agent.query(question.trim(), topK);

    const response: QueryResponse = {
      question,
      answer,
      sources,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (err) {
    console.error('查询错误:', err);
    return c.json({ error: '查询处理失败', details: String(err) }, 500);
  }
}

/**
 * POST /query/stream
 * 流式返回 (Server-Sent Events)
 */
export async function handleQueryStream(c: Context<{ Bindings: Env }>) {
  let body: QueryRequest;
  try {
    body = await c.req.json<QueryRequest>();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const { question, topK } = body;

  if (!question?.trim()) {
    return c.json({ error: '请提供有效的问题内容' }, 400);
  }

  const agent = new RAGAgent(c.env);
  const relevantDocs = await agent.retrieve(question.trim(), topK);

  if (relevantDocs.length === 0) {
    return c.json({
      answer: '知识库中没有找到相关信息，请先上传文档。',
      sources: [],
    });
  }

  const contextText = relevantDocs
    .slice(0, 5)
    .map((doc, i) => `[${i + 1}] (来源: ${doc.source})\n${doc.text}`)
    .join('\n\n')
    .slice(0, 3000);

  const messages: RoleScopedChatInput[] = [
    {
      role: 'system',
      content: '你是一个专业的知识库助手。请基于提供的上下文信息准确回答问题。',
    },
    {
      role: 'user',
      content: `上下文：\n${contextText}\n\n问题：${question}`,
    },
  ];

  const stream = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages,
    stream: true,
  }) as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
