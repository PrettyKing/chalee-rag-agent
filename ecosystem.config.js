module.exports = {
  apps: [{
    name: 'chalee-rag-agent',
    script: 'server.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster',
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      CHROMA_HOST: 'localhost',
      CHROMA_PORT: 8000
    },
    
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      CHROMA_HOST: 'localhost',
      CHROMA_PORT: 8000
    },
    
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Restart settings
    autorestart: true,
    watch: false, // Set to true for development
    max_memory_restart: '500M',
    
    // Advanced settings
    min_uptime: '10s',
    max_restarts: 5,
    restart_delay: 4000,
    
    // Monitoring
    monitoring: true,
    pmx: true,
    
    // Health check
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }]
};