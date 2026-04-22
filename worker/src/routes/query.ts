import { Context } from 'hono';
import type { Env } from '../types';
import { RAGAgent } from '../rag-agent';

/**
 * POST /query
 *
 * 请求体：
 *   question  string   必填
 *   topK      number   可选，默认 5
 *   aiEnabled boolean  可选，是否开启 AI 增强，默认 false
 *   model     string   可选，OpenAI 模型名，如 gpt-4o
 *
 * Header（可选）：
 *   X-AI-Token  用户自带的 OpenAI API Key
 *
 * 响应新增字段：
 *   mode  'rag' | 'direct' | 'kb_only'
 */
export async function handleQuery(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now();

  let body: {
    question: string;
    topK?: number;
    aiEnabled?: boolean;
    model?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误，需要 JSON' }, 400);
  }

  const { question, topK, aiEnabled = false, model } = body;

  if (!question || typeof question !== 'string') {
    return c.json({ error: '请提供有效的问题内容' }, 400);
  }
  if (question.length > 1000) {
    return c.json({ error: '问题长度不能超过 1000 字符' }, 400);
  }

  // 从 header 中读取用户自带的 API Key
  const apiKey = c.req.header('X-AI-Token') || undefined;

  try {
    const agent = new RAGAgent(c.env);
    const result = await agent.query(question.trim(), {
      topK,
      aiEnabled,
      apiKey,
      model,
    });

    return c.json({
      question,
      answer: result.answer,
      sources: result.sources,
      mode: result.mode,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('查询错误:', err);
    return c.json({ error: '查询处理失败', details: String(err) }, 500);
  }
}

/**
 * POST /query/stream
 */
export async function handleQueryStream(c: Context<{ Bindings: Env }>) {
  let body: { question: string; topK?: number; aiEnabled?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误' }, 400);
  }

  const { question, topK, aiEnabled = false } = body;
  if (!question?.trim()) return c.json({ error: '请提供有效的问题内容' }, 400);

  const apiKey = c.req.header('X-AI-Token') || undefined;
  const agent = new RAGAgent(c.env);
  const docs = await agent.retrieve(question.trim(), topK, apiKey);

  if (!docs.length && !aiEnabled) {
    return c.json({ answer: '知识库中没有找到相关信息，请先上传文档或开启 AI 增强。', sources: [], mode: 'kb_only' });
  }

  const contextText = docs.length
    ? docs.slice(0, 5).map((d, i) => `[${i+1}] (来源: ${d.source})\n${d.text}`).join('\n\n').slice(0, 3000)
    : '';

  const messages: RoleScopedChatInput[] = docs.length
    ? [
        { role: 'system', content: '你是一个专业的知识库助手。请基于提供的上下文信息准确回答问题。' },
        { role: 'user', content: `上下文：\n${contextText}\n\n问题：${question}` },
      ]
    : [
        { role: 'system', content: '你是一个智能助手，请直接、准确地回答用户问题。' },
        { role: 'user', content: question },
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
