#!/bin/bash

# Deployment script for Chalee RAG Agent

set -e

echo "🚀 Deploying Chalee RAG Agent..."

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
DEPLOYMENT_TYPE=${1:-"docker"}
ENVIRONMENT=${2:-"production"}

# Validate deployment type
if [[ "$DEPLOYMENT_TYPE" != "docker" && "$DEPLOYMENT_TYPE" != "pm2" && "$DEPLOYMENT_TYPE" != "systemd" ]]; then
    print_error "Invalid deployment type. Use: docker, pm2, or systemd"
    echo "Usage: $0 [docker|pm2|systemd] [production|staging]"
    exit 1
fi

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the project directory?"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js 16+ is required"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Build the application
build_application() {
    print_status "Building application..."
    npm ci --only=production
    mkdir -p documents uploads logs
    print_success "Application built successfully"
}

# Docker deployment
deploy_docker() {
    print_status "Deploying with Docker..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed"
        exit 1
    fi
    
    print_status "Building Docker images..."
    docker-compose build
    
    print_status "Starting services..."
    docker-compose up -d
    
    print_status "Waiting for services to be ready..."
    for i in {1..60}; do
        if curl -s http://localhost:3000/health &> /dev/null; then
            print_success "Services are ready"
            break
        fi
        sleep 1
    done
    
    print_success "Docker deployment completed"
}

# PM2 deployment
deploy_pm2() {
    print_status "Deploying with PM2..."
    
    if ! command -v pm2 &> /dev/null; then
        print_status "Installing PM2..."
        npm install -g pm2
    fi
    
    pm2 stop chalee-rag-agent 2>/dev/null || true
    pm2 delete chalee-rag-agent 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    
    print_success "PM2 deployment completed"
}

# Systemd deployment
deploy_systemd() {
    print_status "Deploying with systemd..."
    
    if ! sudo -n true 2>/dev/null; then
        print_error "Sudo access required for systemd deployment"
        exit 1
    fi
    
    SERVICE_FILE="/etc/systemd/system/chalee-rag-agent.service"
    
    print_status "Creating systemd service file..."
    sudo tee $SERVICE_FILE > /dev/null << EOF
[Unit]
Description=Chalee RAG Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=${ENVIRONMENT}
EnvironmentFile=$(pwd)/.env

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable chalee-rag-agent
    sudo systemctl start chalee-rag-agent
    
    if sudo systemctl is-active --quiet chalee-rag-agent; then
        print_success "Systemd deployment completed"
    else
        print_error "Service failed to start"
        exit 1
    fi
}

# Post-deployment verification
verify_deployment() {
    print_status "Verifying deployment..."
    sleep 5
    
    if curl -s http://localhost:3000/health | grep -q "ok"; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
        return 1
    fi
    
    if curl -s http://localhost:3000/stats | grep -q "documentCount"; then
        print_success "Stats endpoint working"
    else
        print_error "Stats endpoint failed"
        return 1
    fi
    
    print_success "Deployment verification completed"
}

# Display deployment info
show_deployment_info() {
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Service Information:"
    echo "  - Type: $DEPLOYMENT_TYPE"
    echo "  - Environment: $ENVIRONMENT"
    echo "  - URL: http://localhost:3000"
    echo ""
    echo "🔧 Management Commands:"
    
    case $DEPLOYMENT_TYPE in
        "docker")
            echo "  - View logs: docker-compose logs -f"
            echo "  - Stop: docker-compose down"
            echo "  - Restart: docker-compose restart"
            ;;
        "pm2")
            echo "  - View logs: pm2 logs chalee-rag-agent"
            echo "  - Stop: pm2 stop chalee-rag-agent"
            echo "  - Restart: pm2 restart chalee-rag-agent"
            ;;
        "systemd")
            echo "  - View logs: sudo journalctl -u chalee-rag-agent -f"
            echo "  - Stop: sudo systemctl stop chalee-rag-agent"
            echo "  - Restart: sudo systemctl restart chalee-rag-agent"
            ;;
    esac
    
    echo ""
    echo "📚 Next Steps:"
    echo "  1. Test the API: curl http://localhost:3000/health"
    echo "  2. Upload documents to the documents/ folder"
    echo "  3. Configure monitoring and backups"
    echo ""
}

# Main deployment function
main() {
    print_status "Starting deployment process..."
    print_status "Deployment type: $DEPLOYMENT_TYPE"
    print_status "Environment: $ENVIRONMENT"
    
    check_prerequisites
    build_application
    
    case $DEPLOYMENT_TYPE in
        "docker")
            deploy_docker
            ;;
        "pm2")
            deploy_pm2
            ;;
        "systemd")
            deploy_systemd
            ;;
    esac
    
    verify_deployment
    show_deployment_info
    
    print_success "Deployment completed successfully! 🚀"
}

# Run main function
main "$@"