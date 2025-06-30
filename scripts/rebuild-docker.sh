#!/bin/bash

# Stop running containers
echo "Stopping running containers..."
docker-compose -f docker-compose.local.yml down

# Regenerate Prisma client
echo "Regenerating Prisma client..."
npx prisma generate

# Rebuild and start containers
echo "Rebuilding and starting containers..."
docker-compose -f docker-compose.local.yml up --build -d

echo "Done! Check the logs with: docker logs test-asg-server-ts-local"
