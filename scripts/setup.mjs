#!/usr/bin/env node
/**
 * 一键初始化脚本
 * 运行: node scripts/setup.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function log(msg) { console.log(`${GREEN}✅ ${msg}${RESET}`); }
function warn(msg) { console.log(`${YELLOW}⚠️  ${msg}${RESET}`); }
function error(msg) { console.log(`${RED}❌ ${msg}${RESET}`); }
function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (e) {
    return null;
  }
}

console.log('\n🚀 Chalee RAG Agent — Cloudflare 资源初始化\n');

// 1. 创建 Vectorize 索引
console.log('1️⃣  创建 Vectorize 索引...');
const vectorizeResult = run('wrangler vectorize create rag-documents --dimensions=768 --metric=cosine');
if (vectorizeResult) {
  log('Vectorize 索引创建成功: rag-documents (768维, cosine)');
} else {
  warn('Vectorize 索引可能已存在，跳过');
}

// 2. 创建 R2 Bucket
console.log('\n2️⃣  创建 R2 存储桶...');
const r2Result = run('wrangler r2 bucket create chalee-rag-uploads');
if (r2Result) {
  log('R2 存储桶创建成功: chalee-rag-uploads');
} else {
  warn('R2 存储桶可能已存在，跳过');
}

// 3. 创建 KV 命名空间
console.log('\n3️⃣  创建 KV 命名空间...');
const kvOutput = run('wrangler kv namespace create RAG_CACHE');
if (kvOutput) {
  const idMatch = kvOutput.match(/id = "([^"]+)"/);
  if (idMatch) {
    const kvId = idMatch[1];
    log(`KV 命名空间创建成功，ID: ${kvId}`);
    let toml = readFileSync('./wrangler.toml', 'utf-8');
    toml = toml.replace('YOUR_KV_NAMESPACE_ID', kvId);
    writeFileSync('./wrangler.toml', toml);
    log('wrangler.toml 已自动更新 KV namespace ID');
  }
} else {
  warn('KV 命名空间可能已存在，请手动更新 wrangler.toml 中的 KV ID');
}

// 4. 创建 D1 数据库
console.log('\n4️⃣  创建 D1 数据库...');
const d1Output = run('wrangler d1 create rag-metadata');
if (d1Output) {
  const idMatch = d1Output.match(/database_id = "([^"]+)"/);
  if (idMatch) {
    const d1Id = idMatch[1];
    log(`D1 数据库创建成功，ID: ${d1Id}`);
    let toml = readFileSync('./wrangler.toml', 'utf-8');
    toml = toml.replace('YOUR_D1_DATABASE_ID', d1Id);
    writeFileSync('./wrangler.toml', toml);
    log('wrangler.toml 已自动更新 D1 database ID');
  }
} else {
  warn('D1 数据库可能已存在，请手动更新 wrangler.toml 中的 D1 database_id');
}

// 5. 初始化 D1 数据库表
console.log('\n5️⃣  初始化 D1 数据库表...');
const schemaResult = run('wrangler d1 execute rag-metadata --file=./schema.sql');
if (schemaResult !== null) {
  log('D1 数据库表初始化成功 (本地)');
} else {
  warn('D1 本地初始化失败，请手动执行: wrangler d1 execute rag-metadata --file=./schema.sql');
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 初始化完成！

下一步:
  1. 检查并确认 wrangler.toml 中的 ID 已正确填入
  2. 运行 npm run dev 启动本地开发
  3. 运行 npm run deploy 部署到 Cloudflare

可选 (使用 OpenAI 替代 Workers AI):
  wrangler secret put OPENAI_API_KEY
  然后在 wrangler.toml 中设置 USE_OPENAI = "true"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
