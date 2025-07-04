// server-optimized.js
import express from "express";
import multer from "multer";
import cors from "cors";
import OptimizedRAGAgent from "./rag-agent-optimized.js";

const app = express();
const port = process.env.PORT || 3000;

// 内存监控
function logMemoryUsage() {
  const used = process.memoryUsage();
  console.log("\n📊 内存使用情况:");
  console.log(`  RSS: ${Math.round(used.rss / 1024 / 1024)} MB`);
  console.log(`  堆总量: ${Math.round(used.heapTotal / 1024 / 1024)} MB`);
  console.log(`  堆使用: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);
  console.log(`  外部: ${Math.round(used.external / 1024 / 1024)} MB`);
}

// 中间件
app.use(cors());
app.use(express.json({ limit: "10mb" })); // 限制请求大小
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 文件上传配置 - 优化内存使用
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
    files: 10, // 最多10个文件
  },
  fileFilter: (req, file, cb) => {
    // 只允许文本文件
    if (
      file.mimetype === "text/plain" ||
      file.originalname.endsWith(".txt") ||
      file.originalname.endsWith(".md")
    ) {
      cb(null, true);
    } else {
      cb(new Error("只支持 .txt 和 .md 文件"));
    }
  },
});

// 全局RAG Agent实例
let ragAgent = null;

// 初始化RAG Agent
async function initializeAgent() {
  try {
    ragAgent = new OptimizedRAGAgent();
    await ragAgent.initialize();
    console.log("✅ 优化版 RAG Agent 初始化完成");

    // 启动内存监控
    setInterval(logMemoryUsage, 60000); // 每分钟记录一次
    logMemoryUsage(); // 立即记录一次
  } catch (error) {
    console.error("❌ RAG Agent 初始化失败:", error);
    process.exit(1);
  }
}

// 内存清理中间件
app.use((req, res, next) => {
  // 请求完成后强制垃圾回收
  res.on("finish", () => {
    if (global.gc) {
      global.gc();
    }
  });
  next();
});

// API路由

// 健康检查
app.get("/health", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: "ok",
    message: "Optimized RAG Agent API is running",
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    },
    uptime: process.uptime(),
  });
});

// 查询接口 - 添加输入验证和内存优化
app.post("/query", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "请提供有效的问题内容",
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        error: "问题长度不能超过1000字符",
      });
    }

    if (!ragAgent) {
      return res.status(503).json({
        error: "RAG Agent 未初始化",
      });
    }

    console.log(`🔍 收到查询: ${question.substring(0, 50)}...`);
    const startTime = Date.now();

    const answer = await ragAgent.query(question.trim());
    const processingTime = Date.now() - startTime;

    console.log(`✅ 查询完成，耗时: ${processingTime}ms`);

    res.json({
      question: question,
      answer: answer,
      timestamp: new Date().toISOString(),
      processingTime: processingTime,
    });
  } catch (error) {
    console.error("❌ 查询错误:", error);
    res.status(500).json({
      error: "查询处理失败",
      details: error.message,
    });
  }
});

// 上传文档接口 - 优化内存处理
app.post("/upload", upload.array("documents"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "请选择要上传的文件",
      });
    }

    if (!ragAgent) {
      return res.status(503).json({
        error: "RAG Agent 未初始化",
      });
    }

    console.log(`📁 开始处理 ${req.files.length} 个上传文件`);
    const startTime = Date.now();

    // 处理上传的文件
    const filePaths = req.files.map((file) => file.path);
    const documents = await ragAgent.loadDocumentsFromFiles(filePaths);

    if (documents.length > 0) {
      await ragAgent.addDocuments(documents);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ 文件处理完成，耗时: ${processingTime}ms`);

    // 清理临时文件
    try {
      const fs = await import("fs/promises");
      for (const filePath of filePaths) {
        await fs.unlink(filePath);
      }
    } catch (cleanupError) {
      console.warn("⚠️ 清理临时文件失败:", cleanupError.message);
    }

    res.json({
      message: `成功上传并处理 ${documents.length} 个文档`,
      files: req.files.map((f) => f.originalname),
      processingTime: processingTime,
    });
  } catch (error) {
    console.error("❌ 上传错误:", error);
    res.status(500).json({
      error: "文档上传处理失败",
      details: error.message,
    });
  }
});

// 获取统计信息
app.get("/stats", async (req, res) => {
  try {
    if (!ragAgent) {
      return res.status(503).json({
        error: "RAG Agent 未初始化",
      });
    }

    const stats = await ragAgent.getStats();
    res.json(stats);
  } catch (error) {
    console.error("❌ 获取统计信息错误:", error);
    res.status(500).json({
      error: "获取统计信息失败",
      details: error.message,
    });
  }
});

// 批量添加文档 - 优化内存处理
app.post("/documents/batch", async (req, res) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        error: "请提供有效的文档数组",
      });
    }

    if (documents.length > 50) {
      return res.status(400).json({
        error: "一次最多添加50个文档",
      });
    }

    if (!ragAgent) {
      return res.status(503).json({
        error: "RAG Agent 未初始化",
      });
    }

    console.log(`📚 开始批量添加 ${documents.length} 个文档`);
    const startTime = Date.now();

    await ragAgent.addDocuments(documents);

    const processingTime = Date.now() - startTime;
    console.log(`✅ 批量添加完成，耗时: ${processingTime}ms`);

    res.json({
      message: `成功添加 ${documents.length} 个文档`,
      count: documents.length,
      processingTime: processingTime,
    });
  } catch (error) {
    console.error("❌ 批量添加文档错误:", error);
    res.status(500).json({
      error: "批量添加文档失败",
      details: error.message,
    });
  }
});

// 检索接口
app.post("/retrieve", async (req, res) => {
  try {
    const { query, topK = 5 } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "请提供有效的查询内容",
      });
    }

    if (!ragAgent) {
      return res.status(503).json({
        error: "RAG Agent 未初始化",
      });
    }

    const results = await ragAgent.retrieve(query.trim(), Math.min(topK, 20));

    res.json({
      query: query,
      results: results,
      count: results.length,
    });
  } catch (error) {
    console.error("❌ 检索错误:", error);
    res.status(500).json({
      error: "检索失败",
      details: error.message,
    });
  }
});

// 内存清理接口
app.post("/cleanup", async (req, res) => {
  try {
    if (ragAgent && ragAgent.cleanup) {
      await ragAgent.cleanup();
    }

    if (global.gc) {
      global.gc();
    }

    const memUsage = process.memoryUsage();
    res.json({
      message: "内存清理完成",
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      },
    });
  } catch (error) {
    console.error("❌ 清理错误:", error);
    res.status(500).json({
      error: "内存清理失败",
      details: error.message,
    });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error("❌ 服务器错误:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "文件大小超过5MB限制" });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "文件数量超过10个限制" });
    }
  }

  res.status(500).json({
    error: "服务器内部错误",
    details: error.message,
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: "接口不存在",
  });
});

// 优雅关闭
process.on("SIGINT", async () => {
  console.log("\n🛑 收到关闭信号，正在优雅关闭...");

  if (ragAgent && ragAgent.cleanup) {
    await ragAgent.cleanup();
  }

  process.exit(0);
});

// 内存警告
process.on("warning", (warning) => {
  if (warning.name === "MaxListenersExceededWarning") {
    console.warn("⚠️ 内存警告:", warning.message);
  }
});

// 启动服务器
async function startServer() {
  try {
    await initializeAgent();

    app.listen(port, () => {
      console.log(
        `\n🚀 优化版 RAG Agent API 服务器运行在 http://localhost:${port}`
      );
      console.log("\n📋 可用接口:");
      console.log("  🔍 POST /query               - 智能问答");
      console.log("  📁 POST /upload              - 上传文档");
      console.log("  📚 POST /documents/batch     - 批量添加文档");
      console.log("  🔎 POST /retrieve            - 检索相关文档");
      console.log("  📊 GET  /stats               - 获取统计信息");
      console.log("  🏥 GET  /health              - 健康检查");
      console.log("  🧹 POST /cleanup             - 内存清理");
      console.log("\n💡 优化特性:");
      console.log("  • 内存使用监控");
      console.log("  • 批处理优化");
      console.log("  • 自动垃圾回收");
      console.log("  • 文件大小限制");
      console.log("  • 错误恢复机制\n");
    });
  } catch (error) {
    console.error("❌ 启动服务器失败:", error);
    process.exit(1);
  }
}

startServer();
