# Test ASG Server - TypeScript

A TypeScript Express.js server with health check endpoint, environment configuration, and AWS Secrets Manager integration.

## Features

- **TypeScript** - Strongly typed JavaScript
- **Express.js** - Fast, unopinionated, minimalist web framework
- **Prisma ORM** - Next-generation ORM for Node.js and TypeScript
- **MySQL** - Database support
- **Docker** - Containerization for local development and production
- **AWS Secrets Manager** - Secure storage of database credentials
- **Environment Configuration** - Support for different environments (development, staging, production)
- **Health Check** - Endpoint for monitoring application health
- **Logging** - Configurable logging to file and console

## Requirements

- Node.js 18+
- npm 8+
- Docker and Docker Compose (for local development)
- AWS account (for production deployment)

## Getting Started

### Local Development with Docker

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd test-asg-server-ts
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Start the application with Docker Compose:
   ```bash
   npm run docker:local
   ```

4. The server will be available at http://localhost:3001

### Production Deployment with AWS

1. Set up AWS credentials:
   ```bash
   cp .env.aws .env
   ```

2. Update the AWS Secret Manager name in `.env`:
   ```
   AWS_SECRET_NAME=your-secret-name
   ```

3. Build and run the Docker container:
   ```bash
   npm run docker:aws
   ```

## Environment Modes

You can easily switch between local Docker and AWS modes:

```bash
# Switch to local Docker mode
npm run mode:local

# Switch to AWS mode
npm run mode:aws

# Check current mode
npm run mode:status
```

## Project Structure

```
.
├── docker/                 # Docker initialization scripts
├── prisma/                 # Prisma schema and migrations
├── scripts/                # Utility scripts
├── src/                    # Source code
│   ├── config/             # Configuration
│   ├── scripts/            # Application scripts
│   ├── services/           # Business logic
│   └── server.ts           # Main application entry point
├── .dockerignore           # Docker ignore file
├── .env.example            # Example environment variables
├── .env.aws                # AWS environment variables
├── .gitignore              # Git ignore file
├── docker-compose.aws.yml  # Docker Compose for AWS
├── docker-compose.local.yml # Docker Compose for local development
├── Dockerfile              # Docker build file for local development
├── Dockerfile.aws          # Docker build file for AWS
├── package.json            # Node.js dependencies
├── README.md               # This file
└── tsconfig.json           # TypeScript configuration
```

## API Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check endpoint
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user by ID
- `DELETE /api/users/:id` - Delete user by ID

## Environment Variables

See `.env.example` for a list of available environment variables.

## AWS Secrets Manager

For production deployment, the application uses AWS Secrets Manager to securely store database credentials. The secret should have the following structure:

```json
{
  "username": "db_user",
  "password": "db_password",
  "dbname": "db_name",
  "host": "db_host",
  "port": "3306",
  "engine": "mysql"
}
```

## License

MIT
