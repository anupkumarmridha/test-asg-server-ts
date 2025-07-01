#!/bin/bash

# Simple and Reliable EC2 User Data Script for ASG Launch Template
# Creates database schema directly without Prisma migrations

exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "🚀 Starting EC2 deployment at $(date)"

# Update and install Docker (fastest method for Amazon Linux 2)
echo "📦 Installing Docker..."
yum update -y
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
echo "📦 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create application directory
mkdir -p /app && cd /app

# Create Docker Compose with proper database initialization
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    container_name: asg-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: test_asg_db
      MYSQL_USER: mysql_user
      MYSQL_PASSWORD: mysql_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "mysql_user", "-pmysql_password"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 40s
    command: --default-authentication-plugin=mysql_native_password

  app:
    image: anupkumarmridha/test-asg-server:latest
    container_name: asg-app
    ports:
      - "8080:3000"
      - "3000:3000"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - USE_LOCAL_DOCKER=true
      - DB_PROVIDER=docker
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=test_asg_db
      - DB_USER=mysql_user
      - DB_PASSWORD=mysql_password
      - DATABASE_URL=mysql://mysql_user:mysql_password@mysql:3306/test_asg_db
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - app-net
    healthcheck:
      test: ["CMD", "sh", "-c", "wget --no-verbose --tries=1 --spider http://localhost:3000/health || curl -f http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

volumes:
  mysql_data:
networks:
  app-net:
EOF

# Create database initialization script that matches your Prisma schema
cat > init.sql << 'EOF'
-- Initialize the database with required tables
USE test_asg_db;

-- Create health_check table
CREATE TABLE IF NOT EXISTS health_check (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(255) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    INDEX idx_timestamp (timestamp)
);

-- Create system_status table
CREATE TABLE IF NOT EXISTS system_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    response_time INT,
    error_message TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_service_name (service_name),
    INDEX idx_checked_at (checked_at)
);

-- Create user table
CREATE TABLE IF NOT EXISTS user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
);

-- Insert sample data
INSERT IGNORE INTO user (name, email) VALUES 
('System Admin', 'admin@example.com'),
('Test User', 'test@example.com');

-- Insert initial health check
INSERT IGNORE INTO health_check (status) VALUES ('Database initialized');

-- Grant permissions
GRANT ALL PRIVILEGES ON test_asg_db.* TO 'mysql_user'@'%';
FLUSH PRIVILEGES;

-- Show created tables
SHOW TABLES;
EOF

echo "🔄 Pulling Docker images..."
docker-compose pull

echo "🗄️ Starting MySQL database..."
docker-compose up -d mysql

# Wait for MySQL to be completely ready
echo "⏳ Waiting for MySQL to initialize..."
sleep 30

# Verify MySQL is ready and tables are created
max_attempts=20
attempt=1
mysql_ready=false

while [ $attempt -le $max_attempts ]; do
    echo "🔍 Checking MySQL readiness (attempt $attempt/$max_attempts)..."
    
    if docker-compose exec -T mysql mysql -u mysql_user -pmysql_password test_asg_db -e "SHOW TABLES;" > /dev/null 2>&1; then
        echo "✅ MySQL is ready and tables are created!"
        mysql_ready=true
        break
    else
        echo "⏱️ MySQL not ready yet, waiting..."
        sleep 5
    fi
    
    attempt=$((attempt + 1))
done

if [ "$mysql_ready" = false ]; then
    echo "❌ MySQL failed to initialize properly"
    docker-compose logs mysql
    exit 1
fi

# Verify tables exist
echo "🔍 Verifying database tables..."
docker-compose exec -T mysql mysql -u mysql_user -pmysql_password test_asg_db -e "
SHOW TABLES;
SELECT COUNT(*) as health_check_count FROM health_check;
SELECT COUNT(*) as user_count FROM user;
"

echo "🚀 Starting application..."
docker-compose up -d app

# Wait for app to start
echo "⏳ Waiting for application to start..."
sleep 45

# Comprehensive health check
echo "🏥 Performing health checks..."
max_attempts=15
attempt=1
health_check_passed=false

while [ $attempt -le $max_attempts ]; do
    echo "🔍 Health check attempt $attempt/$max_attempts..."
    
    # Try multiple health check methods
    if curl -f -s http://localhost:8080/health >/dev/null 2>&1; then
        echo "✅ Health check passed on port 8080!"
        health_check_passed=true
        break
    elif curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Health check passed on port 3000!"
        health_check_passed=true
        break
    elif wget --no-verbose --tries=1 --spider http://localhost:8080/health >/dev/null 2>&1; then
        echo "✅ Health check passed using wget!"
        health_check_passed=true
        break
    else
        echo "⏱️ Health check failed (attempt $attempt/$max_attempts)"
        if [ $attempt -eq 5 ] || [ $attempt -eq 10 ]; then
            echo "📋 Intermediate status check:"
            docker-compose ps
        fi
        sleep 8
    fi
    
    attempt=$((attempt + 1))
done

# Final status report
if [ "$health_check_passed" = true ]; then
    echo "🎉 APPLICATION DEPLOYED SUCCESSFULLY!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Get public IP
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
    echo "🌐 Access your application at:"
    echo "   • Health Check: http://$PUBLIC_IP:8080/health"
    echo "   • Main App:     http://$PUBLIC_IP:8080/"
    echo "   • Direct Port:  http://$PUBLIC_IP:3000/"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Show final status
    echo "📊 Container Status:"
    docker-compose ps
    
    # Test the health endpoint
    echo "🧪 Testing health endpoint:"
    curl -s http://localhost:8080/health | head -n 5 || echo "Health endpoint test failed"
    
else
    echo "❌ APPLICATION DEPLOYMENT FAILED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Container Status:"
    docker-compose ps
    echo ""
    echo "📋 Application Logs:"
    docker-compose logs --tail=30 app
    echo ""
    echo "📋 MySQL Logs:"
    docker-compose logs --tail=20 mysql
fi

# Create a simple monitoring script
cat > /app/monitor.sh << 'EOF'
#!/bin/bash
# Simple monitoring and restart script
if ! curl -f -s http://localhost:8080/health >/dev/null 2>&1; then
    echo "$(date): Health check failed, restarting application..."
    cd /app && docker-compose restart app
fi
EOF

chmod +x /app/monitor.sh

# Add to cron for monitoring (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /app/monitor.sh >> /var/log/app-monitor.log 2>&1") | crontab -

echo "✅ User data script completed at $(date)"
echo "📝 Logs available at: /var/log/user-data.log"
