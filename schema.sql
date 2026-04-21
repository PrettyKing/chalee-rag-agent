-- D1 数据库初始化
-- 执行命令: wrangler d1 execute rag-metadata --file=./schema.sql

-- 上传记录表
CREATE TABLE IF NOT EXISTS upload_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_names  TEXT    NOT NULL,  -- JSON 数组
  r2_keys     TEXT    NOT NULL,  -- JSON 数组
  chunks_created INTEGER DEFAULT 0,
  created_at  TEXT    NOT NULL
);

-- 文档块元数据表（辅助统计，Vectorize 是主存储）
CREATE TABLE IF NOT EXISTS document_chunks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vector_id    TEXT    NOT NULL UNIQUE, -- 对应 Vectorize 中的 id
  source       TEXT    NOT NULL,
  chunk_index  INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  content_preview TEXT, -- 前 200 字
  created_at   TEXT    NOT NULL
);

-- 查询日志（可选）
CREATE TABLE IF NOT EXISTS query_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  question        TEXT NOT NULL,
  answer_preview  TEXT,
  sources         TEXT, -- JSON 数组
  processing_ms   INTEGER,
  created_at      TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_chunks_source ON document_chunks(source);
CREATE INDEX IF NOT EXISTS idx_chunks_created ON document_chunks(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON query_logs(created_at);
