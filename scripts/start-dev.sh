#!/bin/bash

# Development startup script
# This script starts all necessary services for development

set -e

echo \"🔧 Starting Chalee RAG Agent in development mode...\"

# Colors
BLUE='\\033[0;34m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

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

# Check if .env file exists
if [ ! -f \".env\" ]; then
    print_error \".env file not found. Run 'npm run setup' first.\"
    exit 1
fi

# Check if ChromaDB is running
check_chromadb() {
    if curl -s http://localhost:8000/api/v1/heartbeat &> /dev/null; then
        print_success \"ChromaDB is running\"
        return 0
    else
        print_warning \"ChromaDB is not running\"
        return 1
    fi
}

# Start ChromaDB if not running
start_chromadb() {
    if ! check_chromadb; then
        print_status \"Starting ChromaDB...\"
        
        if command -v docker &> /dev/null; then
            # Try to start existing container first
            if docker ps -a | grep -q \"chalee-chromadb\"; then
                docker start chalee-chromadb
            else
                docker run -d --name chalee-chromadb -p 8000:8000 chromadb/chroma
            fi
            
            # Wait for it to be ready
            for i in {1..30}; do
                if check_chromadb; then
                    break
                fi
                sleep 1
            done
            
            if check_chromadb; then
                print_success \"ChromaDB started successfully\"
            else
                print_error \"Failed to start ChromaDB\"
                exit 1
            fi
        else
            print_error \"Docker not found. Please start ChromaDB manually.\"
            exit 1
        fi
    fi
}

# Function to kill background processes on exit
cleanup() {
    echo \"\"
    print_status \"Stopping development server...\"
    if [ ! -z \"$SERVER_PID\" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start ChromaDB
start_chromadb

# Start the development server
print_status \"Starting development server...\"
print_status \"Press Ctrl+C to stop\"

# Start server in background and capture PID
npm run dev &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Check if server is running
if curl -s http://localhost:3000/health &> /dev/null; then
    print_success \"Development server is running at http://localhost:3000\"
    print_status \"API endpoints:\"
    echo \"  - GET  /health              - Health check\"
    echo \"  - POST /query               - Ask questions\"
    echo \"  - POST /upload              - Upload documents\"
    echo \"  - POST /documents/batch     - Batch add documents\"
    echo \"  - POST /retrieve            - Retrieve documents\"
    echo \"  - GET  /stats               - Get statistics\"
else
    print_error \"Failed to start development server\"
    cleanup
fi

# Wait for the server process
wait $SERVER_PID