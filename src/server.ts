import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import config, { isProduction, isDevelopment } from './config';
import {
  testDatabaseConnection,
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getSystemHealth,
  closeConnection
} from './services/database';

// Define interfaces for request bodies and responses
interface User {
  id?: number;
  name: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  count?: number;
}

const app = express();
const port = config.app.port;

// Ensure logs directory exists
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir) && logDir !== '.') {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(__dirname, '..', config.logging.file);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const log = (message: string, level: string = 'info'): void => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [${level.toUpperCase()}] - ${message}\n`;
  
  // Write to file
  logStream.write(logMessage);
  
  // Console logging based on configuration
  if (config.logging.enableConsole) {
    console.log(logMessage.trim());
  }
};

// Log startup information
log(`Starting ${config.app.name} v${config.app.version}`);
log(`Environment: ${config.app.env}`);
log(`Port: ${port}`);
log(`Logging to: ${config.logging.file}`);
log(`Console logging: ${config.logging.enableConsole ? 'enabled' : 'disabled'}`);
log(`CORS: ${config.api.enableCors ? 'enabled' : 'disabled'}`);
log(`Metrics: ${config.monitoring.enableMetrics ? 'enabled' : 'disabled'}`);

// Security headers for production
if (isProduction()) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Powered-By', config.app.name);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  log(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Dummy data store
let users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', createdAt: new Date(), updatedAt: new Date() }
];

let nextId = 4;

app.get('/', (req: Request, res: Response) => {
  const welcomeData = {
    message: 'Welcome to CI/CD test-asg-server-ts API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: config.app.version,
    endpoints: [
      'GET / - This welcome message',
      'GET /health - Health check endpoint',
      'GET /api/users - Get all users',
      'GET /api/users/:id - Get user by ID',
      'POST /api/users - Create new user',
      'PUT /api/users/:id - Update user by ID',
      'DELETE /api/users/:id - Delete user by ID'
    ]
  };
  log('Root endpoint accessed');
  res.status(200).json(welcomeData);
});

app.get(config.healthCheck.endpoint, async (req: Request, res: Response) => {
  log('Health check requested');
  
  try {
    // Test database connection
    const dbHealth = await testDatabaseConnection();
    
    const healthData = {
      status: dbHealth.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      environment: config.app.env,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth,
      features: {
        cors: config.api.enableCors,
        metrics: config.monitoring.enableMetrics
      }
    };
    
    const statusCode = dbHealth.connected ? 200 : 503;
    res.status(statusCode).json(healthData);
  } catch (error: any) {
    log(`Health check failed: ${error.message}`, 'error');
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: {
        connected: false,
        error: error.message
      }
    });
  }
});

// API Routes
// GET all users
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const result = await getAllUsers();
    if (result.success) {
      log(`Retrieved ${result.data.length} users`);
      res.status(200).json({
        success: true,
        data: result.data,
        count: result.count,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(result.error);
    }
  } catch (error: any) {
    log(`Failed to retrieve users: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET user by ID
app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const result = await getUserById(userId);
    
    if (!result.success) {
      log(`User not found: ID ${userId}`, 'warn');
      return res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }
    
    log(`Retrieved user: ID ${userId}`);
    res.status(200).json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log(`Error retrieving user: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST create new user
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      log('Failed to create user: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Name and email are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const userData: User = { name, email };
    const result = await createUser(userData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    log(`Created new user: ID ${result.data.id}, Name: ${name}`);
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: 'User created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log(`Failed to create user: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT update user by ID
app.put('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { name, email } = req.body;
    
    if (!name || !email) {
      log(`Failed to update user: Missing required fields for ID ${userId}`, 'warn');
      return res.status(400).json({
        success: false,
        error: 'Name and email are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const userData: User = { name, email };
    const result = await updateUser(userId, userData);
    
    if (!result.success) {
      if (result.error === 'User not found') {
        log(`Failed to update user: ID ${userId} not found`, 'warn');
        return res.status(404).json({
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        });
      }
      throw new Error(result.error);
    }
    
    log(`Updated user: ID ${userId}`);
    res.status(200).json({
      success: true,
      data: result.data,
      message: 'User updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log(`Failed to update user: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE user by ID
app.delete('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const result = await deleteUser(userId);
    
    if (!result.success) {
      if (result.error === 'User not found') {
        log(`Failed to delete user: ID ${userId} not found`, 'warn');
        return res.status(404).json({
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        });
      }
      throw new Error(result.error);
    }
    
    log(`Deleted user: ID ${userId}, Name: ${result.data.name}`);
    res.status(200).json({
      success: true,
      data: result.data,
      message: 'User deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log(`Failed to delete user: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler for undefined routes
app.use('*', (req: Request, res: Response) => {
  const notFoundData = {
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET / - Welcome message',
      'GET /health - Health check'
    ]
  };
  log(`404 - ${req.method} ${req.originalUrl}`, 'warn');
  res.status(404).json(notFoundData);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  log('SIGTERM received, shutting down gracefully', 'info');
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log('SIGINT received, shutting down gracefully', 'info');
  await closeConnection();
  process.exit(0);
});

// Start the server
app.listen(port, () => {
  log(`Server started on port ${port}`);
});

export default app;
