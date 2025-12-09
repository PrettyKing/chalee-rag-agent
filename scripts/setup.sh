#!/bin/bash

# Chalee RAG Agent Setup Script
# This script helps set up the development environment

set -e  # Exit on any error

echo \"🚀 Setting up Chalee RAG Agent...\"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e \"${BLUE}[INFO]${NC} $1\"
}

print_success() {
    echo -e \"${GREEN}[SUCCESS]${NC} $1\"
}

print_warning() {
    echo -e \"${YELLOW}[WARNING]${NC} $1\"
}

print_error() {
    echo -e \"${RED}[ERROR]${NC} $1\"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error \"Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/\"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_success \"Node.js found: $NODE_VERSION\"
    
    # Check if version is 16 or higher
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ \"$MAJOR_VERSION\" -lt 16 ]; then
        print_error \"Node.js version 16 or higher is required. Current version: $NODE_VERSION\"
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error \"npm is not installed. Please install npm.\"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    print_success \"npm found: $NPM_VERSION\"
}

# Install dependencies
install_dependencies() {
    print_status \"Installing Node.js dependencies...\"
    npm install
    print_success \"Dependencies installed successfully\"
}

# Set up environment file
setup_env() {
    if [ ! -f \".env\" ]; then
        print_status \"Creating .env file from template...\"
        cp .env.example .env
        print_warning \"Please edit .env file and add your OpenAI API key\"
    else
        print_status \".env file already exists\"
    fi
}

# Create necessary directories
setup_directories() {
    print_status \"Creating necessary directories...\"
    
    mkdir -p documents
    mkdir -p uploads
    mkdir -p chroma_data
    mkdir -p logs
    
    print_success \"Directories created\"
}

# Check Docker installation
check_docker() {
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success \"Docker found: $DOCKER_VERSION\"
        return 0
    else
        print_warning \"Docker not found. You'll need to install ChromaDB manually.\"
        return 1
    fi
}

# Start ChromaDB with Docker
start_chromadb() {
    if check_docker; then
        print_status \"Starting ChromaDB container...\"
        
        # Check if container is already running
        if docker ps | grep -q \"chromadb/chroma\"; then
            print_status \"ChromaDB container is already running\"
        else
            # Check if container exists but is stopped
            if docker ps -a | grep -q \"chalee-chromadb\"; then
                print_status \"Starting existing ChromaDB container...\"
                docker start chalee-chromadb
            else
                print_status \"Creating and starting new ChromaDB container...\"
                docker run -d --name chalee-chromadb -p 8000:8000 chromadb/chroma
            fi
        fi
        
        # Wait for ChromaDB to be ready
        print_status \"Waiting for ChromaDB to be ready...\"
        for i in {1..30}; do
            if curl -s http://localhost:8000/api/v1/heartbeat &> /dev/null; then
                print_success \"ChromaDB is ready\"
                return 0
            fi
            sleep 1
        done
        
        print_error \"ChromaDB failed to start or is not responding\"
        return 1
    else
        print_warning \"Skipping ChromaDB setup due to missing Docker\"
        return 1
    fi
}

# Test the installation
test_installation() {
    print_status \"Testing installation...\"
    
    # Test if we can import the main module
    if node -e \"import('./rag-agent.js').then(() => console.log('✓ RAG Agent module loads successfully'))\"; then
        print_success \"Module test passed\"
    else
        print_error \"Module test failed\"
        return 1
    fi
    
    # Test ChromaDB connection
    if curl -s http://localhost:8000/api/v1/heartbeat &> /dev/null; then
        print_success \"ChromaDB connection test passed\"
    else
        print_warning \"ChromaDB connection test failed - make sure ChromaDB is running\"
    fi
}

# Display next steps
show_next_steps() {
    echo \"\"
    echo \"🎉 Setup complete! Here's what to do next:\"
    echo \"\"
    echo \"1. Edit the .env file and add your OpenAI API key:\"
    echo \"   nano .env\"
    echo \"\"
    echo \"2. Add some documents to the documents/ folder:\"
    echo \"   echo 'Your document content' > documents/sample.txt\"
    echo \"\"
    echo \"3. Start the RAG Agent:\"
    echo \"   # Command line interface:\"
    echo \"   npm start\"
    echo \"\"
    echo \"   # Web API server:\"
    echo \"   npm run server\"
    echo \"\"
    echo \"4. Test the API:\"
    echo \"   curl http://localhost:3000/health\"
    echo \"\"
    echo \"5. Run tests:\"
    echo \"   npm test\"
    echo \"\"
    echo \"📚 Documentation:\"
    echo \"   - README.md - Project overview\"
    echo \"   - docs/SETUP.md - Detailed setup guide\"
    echo \"   - docs/API.md - API documentation\"
    echo \"   - examples/ - Usage examples\"
    echo \"\"
}

# Main setup process
main() {
    print_status \"Starting setup process...\"
    
    check_node
    check_npm
    install_dependencies
    setup_env
    setup_directories
    
    if start_chromadb; then
        test_installation
    else
        print_warning \"ChromaDB setup skipped. Please set it up manually.\"
        print_warning \"See docs/SETUP.md for manual installation instructions.\"
    fi
    
    show_next_steps
    
    print_success \"Setup completed successfully! 🚀\"
}

# Run main function
main \"$@\"