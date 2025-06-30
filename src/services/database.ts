import { PrismaClient } from '@prisma/client';
import config from '../config';

/**
 * Database service using Prisma for AWS RDS connectivity
 * Supports both local Docker development and AWS RDS in production
 */

let prisma: PrismaClient | null = null;

/**
 * Get database connection URL based on environment
 */
const getDatabaseUrl = (): string => {
  // If DATABASE_URL is explicitly set, use it
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // If using AWS Secrets Manager in production
  if (config.app.env === 'production' && process.env.SECRETS_DB_USER) {
    const dbType = config.database.type || 'mysql';
    const host = config.database.rds.endpoint || process.env.AWS_RDS_ENDPOINT || config.database.host;
    const port = config.database.port;
    const dbName = process.env.SECRETS_DB_NAME || config.database.name;
    const user = process.env.SECRETS_DB_USER;
    const password = process.env.SECRETS_DB_PASSWORD;
    
    return `${dbType}://${user}:${password}@${host}:${port}/${dbName}?sslmode=${config.database.rds.sslMode}`;
  }

  // For local Docker development
  const dbType = config.database.type || 'mysql';
  const host = config.database.host;
  const port = config.database.port;
  const dbName = config.database.name;
  const user = config.database.user;
  const password = config.database.password;
  
  return `${dbType}://${user}:${password}@${host}:${port}/${dbName}`;
};

/**
 * Initialize Prisma client
 */
const initPrisma = (): PrismaClient => {
  if (!prisma) {
    const databaseUrl = getDatabaseUrl();
    console.log(`Connecting to database: ${databaseUrl.replace(/:[^:]*@/, ':****@')}`);
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      },
      log: config.app.env === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
    });
  }
  return prisma;
};

/**
 * Test database connection and perform operations
 */
const testDatabaseConnection = async (): Promise<any> => {
  try {
    const client = initPrisma();
    const start = Date.now();
    
    // Test basic connection
    await client.$connect();
    
    // Test write operation - insert health check record
    const healthRecord = await client.healthCheck.create({
      data: {
        status: 'healthy',
        metadata: {
          environment: config.app.env,
          timestamp: new Date().toISOString(),
          version: config.app.version
        }
      }
    });

    // Test read operation - get recent health checks
    const recentHealthChecks = await client.healthCheck.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' }
    });

    const responseTime = Date.now() - start;

    // Log system status
    await client.systemStatus.create({
      data: {
        serviceName: 'database',
        status: 'healthy',
        responseTime: responseTime
      }
    });

    return {
      connected: true,
      responseTime,
      database: {
        type: 'mysql',
        status: 'healthy'
      },
      operations: {
        write: true,
        read: true,
        lastHealthCheckId: healthRecord.id,
        recentChecksCount: recentHealthChecks.length
      },
      metadata: {
        prismaVersion: require('@prisma/client/package.json').version,
        environment: config.app.env
      }
    };
  } catch (error: any) {
    // Log failed system status
    try {
      if (prisma) {
        await prisma.systemStatus.create({
          data: {
            serviceName: 'database',
            status: 'unhealthy',
            errorMessage: error.message
          }
        });
      }
    } catch (logError) {
      console.error('Failed to log system status:', logError);
    }

    return {
      connected: false,
      error: error.message,
      code: error.code,
      database: {
        type: 'mysql',
        status: 'unhealthy'
      }
    };
  }
};

/**
 * Get all users from database
 */
const getAllUsers = async (): Promise<any> => {
  try {
    const client = initPrisma();
    const users = await client.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: users, count: users.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Create a new user
 */
const createUser = async (userData: any): Promise<any> => {
  try {
    const client = initPrisma();
    const user = await client.user.create({
      data: userData
    });
    return { success: true, data: user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get user by ID
 */
const getUserById = async (id: string): Promise<any> => {
  try {
    const client = initPrisma();
    const user = await client.user.findUnique({
      where: { id: parseInt(id) }
    });
    return user ? { success: true, data: user } : { success: false, error: 'User not found' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Update user by ID
 */
const updateUser = async (id: string, userData: any): Promise<any> => {
  try {
    const client = initPrisma();
    const user = await client.user.update({
      where: { id: parseInt(id) },
      data: userData
    });
    return { success: true, data: user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete user by ID
 */
const deleteUser = async (id: string): Promise<any> => {
  try {
    const client = initPrisma();
    const user = await client.user.delete({
      where: { id: parseInt(id) }
    });
    return { success: true, data: user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get system health status
 */
const getSystemHealth = async (): Promise<any> => {
  try {
    const client = initPrisma();
    const recentStatus = await client.systemStatus.findMany({
      take: 10,
      orderBy: { checkedAt: 'desc' }
    });
    
    const healthySystems = recentStatus.filter(s => s.status === 'healthy').length;
    const totalSystems = recentStatus.length;
    
    return {
      success: true,
      data: {
        overallHealth: healthySystems === totalSystems ? 'healthy' : 'degraded',
        healthyServices: healthySystems,
        totalServices: totalSystems,
        recentStatus: recentStatus
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Close database connection
 */
const closeConnection = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
};

export {
  initPrisma,
  testDatabaseConnection,
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getSystemHealth,
  closeConnection
};
