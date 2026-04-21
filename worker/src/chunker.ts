/**
 * 文本分块工具
 * 从原项目 rag-agent.js splitText() 迁移，新增语义边界优化
 */

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * 基础滑动窗口分块
 * 与原项目逻辑一致，增加了语义边界优先切割
 */
export function splitText(text: string, options: ChunkOptions = {}): string[] {
  const { chunkSize = 800, overlap = 100 } = options;

  if (!text || text.length === 0) return [];
  if (chunkSize <= 0) return [text];

  const safeOverlap = overlap >= chunkSize
    ? Math.floor(chunkSize * 0.1)
    : overlap;

  const chunks: string[] = [];
  let start = 0;
  const maxIterations = Math.ceil(text.length / (chunkSize - safeOverlap)) + 10;
  let iterCount = 0;

  while (start < text.length && iterCount < maxIterations) {
    let end = Math.min(start + chunkSize, text.length);

    // 语义边界优化: 尽量在段落/句子边界切割
    if (end < text.length) {
      const boundary = findSemanticBoundary(text, end, 150);
      if (boundary > start) end = boundary;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    const nextStart = start + chunkSize - safeOverlap;
    start = nextStart <= start ? start + 1 : nextStart;
    iterCount++;
  }

  return chunks;
}

/**
 * 在指定位置附近寻找最近的语义边界
 * 优先级: 段落 > 句子结尾 > 逗号 > 空格
 */
function findSemanticBoundary(text: string, pos: number, lookback: number): number {
  const searchStart = Math.max(0, pos - lookback);
  const segment = text.slice(searchStart, pos);

  // 段落边界
  const paraIdx = segment.lastIndexOf('\n\n');
  if (paraIdx !== -1) return searchStart + paraIdx + 2;

  // 句子边界（中英文）
  const sentenceEnd = Math.max(
    segment.lastIndexOf('。'),
    segment.lastIndexOf('！'),
    segment.lastIndexOf('？'),
    segment.lastIndexOf('. '),
    segment.lastIndexOf('! '),
    segment.lastIndexOf('? '),
  );
  if (sentenceEnd !== -1) return searchStart + sentenceEnd + 1;

  // 换行
  const newlineIdx = segment.lastIndexOf('\n');
  if (newlineIdx !== -1) return searchStart + newlineIdx + 1;

  // 空格
  const spaceIdx = segment.lastIndexOf(' ');
  if (spaceIdx !== -1) return searchStart + spaceIdx + 1;

  return pos;
}

/**
 * 按文件类型预处理文本
 */
export function preprocessText(content: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'md') {
    return content
      .replace(/```[\s\S]*?```/g, (match) => match)
      .replace(/#{1,6}\s/g, '')
      .trim();
  }

  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
