# Contributing to Chalee RAG Agent

We welcome contributions to the Chalee RAG Agent project! This document provides guidelines for contributing.

## Getting Started

### Prerequisites

- Node.js 16.0.0 or higher
- Git
- OpenAI API key (for testing)
- ChromaDB setup

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/chalee-rag-agent.git
   cd chalee-rag-agent
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```
5. Start ChromaDB:
   ```bash
   docker run -p 8000:8000 chromadb/chroma
   ```
6. Run tests:
   ```bash
   npm test
   ```

## How to Contribute

### Reporting Issues

- Use the [GitHub Issues](https://github.com/PrettyKing/chalee-rag-agent/issues) page
- Check if the issue already exists
- Provide detailed information:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Environment details (Node.js version, OS, etc.)
  - Error messages and logs

### Suggesting Features

- Open an issue with the "enhancement" label
- Describe the feature and its use case
- Explain why it would be valuable
- Consider implementation complexity

### Code Contributions

1. **Choose an Issue**: Look for issues labeled "good first issue" or "help wanted"
2. **Create a Branch**: 
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make Changes**: Follow our coding standards
4. **Test**: Ensure all tests pass
5. **Commit**: Use clear, descriptive commit messages
6. **Push**: Push your branch to your fork
7. **Pull Request**: Create a PR with a clear description

## Coding Standards

### JavaScript Style

- Use ES6+ features
- Use `const` and `let` instead of `var`
- Use arrow functions where appropriate
- Use async/await for asynchronous operations
- Add JSDoc comments for functions

```javascript
/**
 * Retrieves relevant documents for a given query
 * @param {string} query - The search query
 * @param {number} topK - Number of documents to retrieve
 * @returns {Promise<string[]>} Array of relevant document chunks
 */
async retrieve(query, topK = 5) {
    // Implementation
}
```

### Code Organization

- Keep functions small and focused
- Use meaningful variable and function names
- Separate concerns (e.g., data processing vs. API handling)
- Add error handling with descriptive messages

### Testing

- Write tests for new features
- Ensure existing tests still pass
- Test edge cases and error conditions
- Use descriptive test names

```javascript
// Good test name
test('should return empty array when no documents match query', async () => {
    // Test implementation
});
```

## Pull Request Guidelines

### PR Title Format

- Use clear, descriptive titles
- Start with a verb (Add, Fix, Update, Remove)
- Examples:
  - "Add support for PDF document processing"
  - "Fix memory leak in document chunking"
  - "Update API documentation"

### PR Description

Include:
- **What**: Brief description of changes
- **Why**: Reason for the changes
- **How**: Implementation approach
- **Testing**: How you tested the changes
- **Screenshots**: If UI changes are involved

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests have been added/updated
- [ ] All tests pass
- [ ] Documentation has been updated
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages are clear and descriptive

## Development Guidelines

### Adding New Features

1. **Document First**: Update documentation
2. **Test-Driven**: Write tests before implementation
3. **Incremental**: Break large features into smaller PRs
4. **Backward Compatible**: Avoid breaking existing APIs

### Bug Fixes

1. **Reproduce**: Create a test that reproduces the bug
2. **Fix**: Implement the fix
3. **Verify**: Ensure the test now passes
4. **Regression**: Check for unintended side effects

### Documentation

- Update README.md for user-facing changes
- Update API documentation for API changes
- Add inline comments for complex logic
- Update examples if relevant

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test component interactions
3. **API Tests**: Test HTTP endpoints
4. **Performance Tests**: Test response times and memory usage

### Writing Tests

```javascript
import { test, expect } from '@jest/globals';
import RAGAgent from './rag-agent.js';

test('should initialize RAG agent successfully', async () => {
    const agent = new RAGAgent();
    await agent.initialize();
    
    expect(agent.collection).toBeDefined();
    expect(agent.collectionName).toBe('documents');
});
```

## Community

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on the project's success

### Communication

- **Issues**: For bug reports and feature requests
- **Discussions**: For general questions and ideas
- **Pull Requests**: For code contributions

### Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in documentation

## Getting Help

### Resources

- [Project Documentation](docs/)
- [API Reference](docs/API.md)
- [Setup Guide](docs/SETUP.md)
- [Configuration Guide](docs/CONFIGURATION.md)

### Support Channels

1. **GitHub Issues**: For bugs and feature requests
2. **GitHub Discussions**: For questions and community chat
3. **Documentation**: Check existing docs first

Thank you for contributing to Chalee RAG Agent! 🚀