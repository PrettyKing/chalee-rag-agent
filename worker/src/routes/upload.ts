import { Context } from 'hono';
import type { Env, UploadResponse } from '../types';
import { RAGAgent } from '../rag-agent';

const ALLOWED_EXTENSIONS = ['.txt', '.md'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 10;

/**
 * POST /upload
 * 原 server.js: app.post('/upload', upload.array('documents'), ...) 迁移
 */
export async function handleUpload(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now();

  const formData = await c.req.formData().catch(() => null);
  if (!formData) {
    return c.json({ error: '请求格式错误，需要 multipart/form-data' }, 400);
  }

  const files = formData.getAll('documents') as File[];

  if (!files || files.length === 0) {
    return c.json({ error: '请选择要上传的文件' }, 400);
  }
  if (files.length > MAX_FILES) {
    return c.json({ error: `一次最多上传 ${MAX_FILES} 个文件` }, 400);
  }

  for (const file of files) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return c.json({ error: `不支持的文件类型: ${file.name}，仅支持 .txt 和 .md` }, 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: `文件 ${file.name} 超过 5MB 限制` }, 400);
    }
  }

  const uploadedFiles: string[] = [];
  const r2Keys: string[] = [];
  let chunksCreated = 0;

  try {
    for (const file of files) {
      const key = `uploads/${Date.now()}-${file.name}`;
      const content = await file.text();

      await c.env.R2.put(key, content, {
        httpMetadata: { contentType: file.type || 'text/plain' },
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          size: String(file.size),
        },
      });

      r2Keys.push(key);
      uploadedFiles.push(file.name);
      console.log(`文件上传到 R2: ${key}`);
    }

    const agent = new RAGAgent(c.env);
    const documents = await agent.loadDocumentsFromR2(r2Keys);

    if (documents.length > 0) {
      const result = await agent.addDocuments(documents);
      chunksCreated = result.chunksCreated;
      await recordToD1(c.env, uploadedFiles, r2Keys, chunksCreated);
    }

    const response: UploadResponse = {
      message: `成功上传并处理 ${documents.length} 个文档`,
      files: uploadedFiles,
      documentsProcessed: documents.length,
      chunksCreated,
      processingTime: Date.now() - startTime,
    };

    return c.json(response);
  } catch (err) {
    console.error('上传处理错误:', err);
    return c.json({ error: '文档上传处理失败', details: String(err) }, 500);
  }
}

/**
 * POST /documents/batch
 */
export async function handleBatchDocuments(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now();

  let body: { documents: Array<{ content: string; source?: string }> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '请求体格式错误，需要 JSON' }, 400);
  }

  const { documents } = body;

  if (!documents || !Array.isArray(documents)) {
    return c.json({ error: '请提供有效的文档数组' }, 400);
  }
  if (documents.length === 0) {
    return c.json({ error: '文档数组不能为空' }, 400);
  }
  if (documents.length > 50) {
    return c.json({ error: '一次最多添加 50 个文档' }, 400);
  }

  try {
    const agent = new RAGAgent(c.env);
    const { chunksCreated } = await agent.addDocuments(documents);

    return c.json({
      message: `成功添加 ${documents.length} 个文档`,
      count: documents.length,
      chunksCreated,
      processingTime: Date.now() - startTime,
    });
  } catch (err) {
    console.error('批量添加文档错误:', err);
    return c.json({ error: '批量添加文档失败', details: String(err) }, 500);
  }
}

async function recordToD1(env: Env, fileNames: string[], r2Keys: string[], chunksCreated: number) {
  try {
    await env.DB.prepare(`
      INSERT INTO upload_records (file_names, r2_keys, chunks_created, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      JSON.stringify(fileNames),
      JSON.stringify(r2Keys),
      chunksCreated,
      new Date().toISOString(),
    ).run();
  } catch (err) {
    console.warn('D1 记录失败 (可忽略):', err);
  }
}
