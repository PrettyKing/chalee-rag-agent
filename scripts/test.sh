#!/bin/bash

# Test script for Chalee RAG Agent

set -e

echo \"🧪 Running Chalee RAG Agent tests...\"

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

# Check prerequisites
check_prerequisites() {
    print_status \"Checking prerequisites...\"
    
    if [ ! -f \"package.json\" ]; then
        print_error \"package.json not found. Are you in the project directory?\"
        exit 1
    fi
    
    if [ ! -d \"node_modules\" ]; then
        print_error \"node_modules not found. Run 'npm install' first.\"
        exit 1
    fi
    
    print_success \"Prerequisites check passed\"
}

# Start test ChromaDB instance
start_test_chromadb() {
    print_status \"Starting test ChromaDB instance...\"
    
    if command -v docker &> /dev/null; then
        # Stop and remove existing test container
        docker stop chalee-chromadb-test 2>/dev/null || true
        docker rm chalee-chromadb-test 2>/dev/null || true
        
        # Start new test container
        docker run -d --name chalee-chromadb-test -p 8001:8000 chromadb/chroma
        
        # Wait for it to be ready
        for i in {1..30}; do
            if curl -s http://localhost:8001/api/v1/heartbeat &> /dev/null; then
                print_success \"Test ChromaDB is ready\"
                return 0
            fi
            sleep 1
        done
        
        print_error \"Test ChromaDB failed to start\"
        return 1
    else
        print_warning \"Docker not found. Skipping ChromaDB test setup.\"
        return 1
    fi
}

# Stop test ChromaDB instance
stop_test_chromadb() {
    if command -v docker &> /dev/null; then
        print_status \"Stopping test ChromaDB instance...\"
        docker stop chalee-chromadb-test 2>/dev/null || true
        docker rm chalee-chromadb-test 2>/dev/null || true
        print_success \"Test ChromaDB stopped\"
    fi
}

# Run unit tests
run_unit_tests() {
    print_status \"Running unit tests...\"
    
    # Set test environment
    export NODE_ENV=test
    export CHROMA_PORT=8001
    
    # Run the test file
    if node test.js; then
        print_success \"Unit tests passed\"
        return 0
    else
        print_error \"Unit tests failed\"
        return 1
    fi
}

# Run API tests
run_api_tests() {
    print_status \"Running API tests...\"
    
    # Start server in background
    export NODE_ENV=test
    export CHROMA_PORT=8001
    export PORT=3001
    
    node server.js &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 3
    
    # Test API endpoints
    local test_passed=true
    
    # Health check
    if curl -s http://localhost:3001/health | grep -q \"ok\"; then
        print_success \"Health check test passed\"
    else
        print_error \"Health check test failed\"
        test_passed=false
    fi
    
    # Stats endpoint
    if curl -s http://localhost:3001/stats | grep -q \"documentCount\"; then
        print_success \"Stats endpoint test passed\"
    else
        print_error \"Stats endpoint test failed\"
        test_passed=false
    fi
    
    # Add test document
    if curl -s -X POST http://localhost:3001/documents/batch \\
        -H \"Content-Type: application/json\" \\
        -d '{\"documents\":[{\"content\":\"Test document\",\"source\":\"test.txt\"}]}' | grep -q \"success\"; then
        print_success \"Document addition test passed\"
    else
        print_error \"Document addition test failed\"
        test_passed=false
    fi
    
    # Stop server
    kill $SERVER_PID 2>/dev/null || true
    
    if $test_passed; then
        print_success \"API tests passed\"
        return 0
    else
        print_error \"Some API tests failed\"
        return 1
    fi
}

# Run linting
run_linting() {
    print_status \"Running code linting...\"
    
    # Check for common issues
    local lint_passed=true
    
    # Check for console.log statements (except in test files)
    if grep -r \"console\\.log\" --include=\"*.js\" --exclude=\"test.js\" --exclude-dir=\"examples\" . &> /dev/null; then
        print_warning \"Found console.log statements in production code\"
        grep -r \"console\\.log\" --include=\"*.js\" --exclude=\"test.js\" --exclude-dir=\"examples\" .
    fi
    
    # Check for TODO comments
    if grep -r \"TODO\\|FIXME\" --include=\"*.js\" . &> /dev/null; then
        print_warning \"Found TODO/FIXME comments\"
        grep -r \"TODO\\|FIXME\" --include=\"*.js\" .
    fi
    
    print_success \"Linting completed\"
}

# Cleanup function
cleanup() {
    print_status \"Cleaning up...\"
    stop_test_chromadb
    # Kill any remaining processes
    pkill -f \"node server.js\" 2>/dev/null || true
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# Main test execution
main() {
    local overall_success=true
    
    check_prerequisites
    
    # Initialize test results
    UNIT_TESTS_PASSED=false
    API_TESTS_PASSED=false
    
    # Start test database
    if start_test_chromadb; then
        # Run unit tests
        if run_unit_tests; then
            UNIT_TESTS_PASSED=true
        else
            overall_success=false
        fi
        
        # Run API tests
        if run_api_tests; then
            API_TESTS_PASSED=true
        else
            overall_success=false
        fi
    else
        print_warning \"Skipping tests due to ChromaDB setup failure\"
        overall_success=false
    fi
    
    # Run linting
    run_linting
    
    # Final result
    if $overall_success; then
        print_success \"All tests passed! 🎉\"
        exit 0
    else
        print_error \"Some tests failed. Check the output above.\"
        exit 1
    fi
}

# Run main function