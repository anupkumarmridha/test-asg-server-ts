#!/bin/bash

# Script to switch between local Docker and AWS modes
# Usage: ./switch-mode.sh [local|aws]

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default mode
MODE=${1:-status}

# Function to display current mode
show_status() {
  if [ -f .env ]; then
    if grep -q "USE_LOCAL_DOCKER=true" .env; then
      echo -e "${GREEN}Current mode: LOCAL DOCKER${NC}"
      echo "Using local Docker containers for database"
    elif grep -q "USE_AWS_SECRETS=true" .env; then
      echo -e "${GREEN}Current mode: AWS${NC}"
      echo "Using AWS Secrets Manager for database credentials"
    else
      echo -e "${YELLOW}Current mode: UNDEFINED${NC}"
      echo "Mode not explicitly set in .env file"
    fi
  else
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Create a .env file first by copying from .env.example"
    exit 1
  fi
}

# Function to switch to local Docker mode
switch_to_local() {
  echo -e "${GREEN}Switching to LOCAL DOCKER mode...${NC}"
  
  # Create backup of current .env file
  cp .env .env.backup
  
  # Update or add environment variables
  if grep -q "USE_LOCAL_DOCKER=" .env; then
    sed -i.bak 's/USE_LOCAL_DOCKER=.*/USE_LOCAL_DOCKER=true/' .env
  else
    echo "USE_LOCAL_DOCKER=true" >> .env
  fi
  
  if grep -q "USE_AWS_SECRETS=" .env; then
    sed -i.bak 's/USE_AWS_SECRETS=.*/USE_AWS_SECRETS=false/' .env
  else
    echo "USE_AWS_SECRETS=false" >> .env
  fi
  
  if grep -q "DB_PROVIDER=" .env; then
    sed -i.bak 's/DB_PROVIDER=.*/DB_PROVIDER=docker/' .env
  else
    echo "DB_PROVIDER=docker" >> .env
  fi
  
  echo -e "${GREEN}Successfully switched to LOCAL DOCKER mode${NC}"
  echo "To start the application with local Docker:"
  echo "  npm run docker:local"
  echo "or"
  echo "  docker-compose -f docker-compose.local.yml up"
}

# Function to switch to AWS mode
switch_to_aws() {
  echo -e "${GREEN}Switching to AWS mode...${NC}"
  
  # Create backup of current .env file
  cp .env .env.backup
  
  # Update or add environment variables
  if grep -q "USE_LOCAL_DOCKER=" .env; then
    sed -i.bak 's/USE_LOCAL_DOCKER=.*/USE_LOCAL_DOCKER=false/' .env
  else
    echo "USE_LOCAL_DOCKER=false" >> .env
  fi
  
  if grep -q "USE_AWS_SECRETS=" .env; then
    sed -i.bak 's/USE_AWS_SECRETS=.*/USE_AWS_SECRETS=true/' .env
  else
    echo "USE_AWS_SECRETS=true" >> .env
  fi
  
  if grep -q "DB_PROVIDER=" .env; then
    sed -i.bak 's/DB_PROVIDER=.*/DB_PROVIDER=aws-rds/' .env
  else
    echo "DB_PROVIDER=aws-rds" >> .env
  fi
  
  # Check if AWS secret name is set
  if ! grep -q "AWS_SECRET_NAME=" .env; then
    echo "AWS_SECRET_NAME=anup-training-dev-db-credentials" >> .env
    echo -e "${YELLOW}Added default AWS_SECRET_NAME. Please update it if needed.${NC}"
  fi
  
  # Check if AWS region is set
  if ! grep -q "AWS_RDS_REGION=" .env; then
    echo "AWS_RDS_REGION=us-east-1" >> .env
    echo -e "${YELLOW}Added default AWS_RDS_REGION. Please update it if needed.${NC}"
  fi
  
  echo -e "${GREEN}Successfully switched to AWS mode${NC}"
  echo "To start the application with AWS Secrets Manager:"
  echo "  npm run docker:aws"
  echo "or"
  echo "  docker-compose -f docker-compose.aws.yml up"
  
  echo -e "${YELLOW}Note: Make sure you have proper AWS credentials configured${NC}"
  echo "For local testing with AWS, you may need to set:"
  echo "  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in your .env file"
}

# Main logic
case "$MODE" in
  local)
    switch_to_local
    ;;
  aws)
    switch_to_aws
    ;;
  status)
    show_status
    echo ""
    echo "Usage: ./scripts/switch-mode.sh [local|aws]"
    echo "  local - Switch to local Docker mode"
    echo "  aws   - Switch to AWS Secrets Manager mode"
    ;;
  *)
    echo -e "${RED}Invalid mode: $MODE${NC}"
    echo "Usage: ./scripts/switch-mode.sh [local|aws]"
    exit 1
    ;;
esac

# Clean up backup files created by sed on macOS
rm -f .env.bak

exit 0
