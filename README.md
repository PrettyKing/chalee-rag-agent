# Chalee RAG Agent

🤖 A powerful RAG (Retrieval-Augmented Generation) Agent implementation in Node.js with vector database support and web API.

## ✨ Features

- 📚 **Document Processing**: Support for text document ingestion and chunking
- 🔍 **Vector Search**: Efficient similarity search using ChromaDB
- 🧠 **Smart Retrieval**: Context-aware document retrieval
- 💬 **Natural Language Generation**: AI-powered response generation
- 🌐 **Web API**: RESTful API for easy integration
- 📤 **File Upload**: Support for document upload via web interface
- ⚡ **Real-time Processing**: Fast query processing and response generation
- 🔧 **Configurable**: Easy configuration for different use cases

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Documents     │───▶│ Vector Store │───▶│   Retrieval     │
│   (Text Files)  │    │  (ChromaDB)  │    │   (Top-K)       │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                                                     ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Response      │◀───│   LLM        │◀───│   Context       │
│   Generation    │    │  (OpenAI)    │    │   Augmentation  │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- OpenAI API Key
- ChromaDB (via Docker or Python installation)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/PrettyKing/chalee-rag-agent.git
   cd chalee-rag-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

4. **Start ChromaDB**
   ```bash
   # Using Docker (recommended)
   docker run -p 8000:8000 chromadb/chroma
   
   # Or using Python
   pip install chromadb
   chroma run --host localhost --port 8000 --path ./chroma_data
   ```

5. **Prepare your documents**
   ```bash
   mkdir documents
   # Add your .txt files to the documents folder
   ```

6. **Run the application**
   ```bash
   # Command line interface
   npm start
   
   # Web API server
   npm run server
   ```

## 📖 Usage

### Command Line Interface

```bash
npm start
```

This will start an interactive CLI where you can ask questions and get AI-powered answers based on your documents.

### Web API

```bash
npm run server
```

The API server will start on `http://localhost:3000` with the following endpoints:

#### Query Endpoint
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is artificial intelligence?"}'
```

#### Upload Documents
```bash
curl -X POST http://localhost:3000/upload \
  -F "documents=@document1.txt" \
  -F "documents=@document2.txt"
```

#### Get Statistics
```bash
curl http://localhost:3000/stats
```

### API Reference

| Endpoint | Method | Description |
|----------|--------|--------------|
| `/query` | POST | Ask questions and get AI responses |
| `/upload` | POST | Upload documents for indexing |
| `/documents/batch` | POST | Batch add documents from JSON |
| `/retrieve` | POST | Retrieve relevant documents only |
| `/stats` | GET | Get database statistics |
| `/health` | GET | Health check |

## 🔧 Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
CHROMA_HOST=localhost
CHROMA_PORT=8000
PORT=3000
```

### Customization

You can customize various aspects of the RAG agent:

- **Chunk Size**: Modify `chunkSize` in `rag-agent.js`
- **Overlap**: Adjust `overlap` parameter for document chunking
- **Top-K**: Change the number of retrieved documents
- **Model**: Switch between different OpenAI models
- **Temperature**: Adjust response creativity

## 📁 Project Structure

```
chalee-rag-agent/
├── rag-agent.js          # Core RAG agent implementation
├── server.js             # Web API server
├── package.json          # Project dependencies
├── .env.example          # Environment variables template
├── README.md             # Project documentation
├── documents/            # Document storage folder
├── uploads/              # Uploaded files folder
└── chroma_data/          # ChromaDB data (auto-created)
```

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` for automatic restart on file changes.

### Testing

```bash
npm test
```

## 🌟 Advanced Features

### Local Embeddings

For privacy-focused deployments, you can use local embedding models:

```javascript
import { pipeline } from '@xenova/transformers';

// Use local embedding model instead of OpenAI
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
```

### Caching

Implement response caching for better performance:

```javascript
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes
```

### Multiple Document Formats

Extend support for different file formats:

- PDF documents
- Word documents
- Markdown files
- Web scraping

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for the GPT models and embeddings
- [ChromaDB](https://www.trychroma.com/) for the vector database
- [Transformers.js](https://huggingface.co/docs/transformers.js) for local ML capabilities

## 📞 Support

If you have any questions or need help, please:

1. Check the [Issues](https://github.com/PrettyKing/chalee-rag-agent/issues) page
2. Create a new issue if your question isn't already answered
3. Join our discussions in the [Discussions](https://github.com/PrettyKing/chalee-rag-agent/discussions) tab

---

⭐ If you find this project helpful, please give it a star!