import dotenv from 'dotenv';
dotenv.config();

/**
 * Application Configuration
 * Centralized configuration management with environment variable support
 */

interface DatabaseConfig {
  provider: string;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  type: string;
  ssl: boolean;
  url: string | null;
  docker: {
    containerName: string;
    image: string;
    autoStart: boolean;
  };
  rds: {
    endpoint: string;
    region: string;
    sslMode: string;
  };
}

interface AppConfig {
  name: string;
  version: string;
  env: string;
  port: number;
}

interface LoggingConfig {
  level: string;
  file: string;
  enableConsole: boolean;
}

interface ApiConfig {
  prefix: string;
  enableCors: boolean;
  corsOrigin: string;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface HealthCheckConfig {
  endpoint: string;
}

interface RedisConfig {
  host: string;
  port: number;
  password: string;
}

interface JwtConfig {
  secret: string;
  expiresIn: string;
}

interface ExternalConfig {
  apiUrl: string;
  apiKey: string;
}

interface MonitoringConfig {
  enableMetrics: boolean;
  metricsPort: number;
}

interface FeatureConfig {
  enableUserManagement: boolean;
  enableAdvancedLogging: boolean;
}

export interface Config {
  app: AppConfig;
  logging: LoggingConfig;
  api: ApiConfig;
  rateLimit: RateLimitConfig;
  healthCheck: HealthCheckConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  external: ExternalConfig;
  monitoring: MonitoringConfig;
  features: FeatureConfig;
}

const config: Config = {
  // Application Settings
  app: {
    name: process.env.APP_NAME || 'test-asg-server-ts',
    version: process.env.APP_VERSION || '1.0.0',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'app.log',
    enableConsole: process.env.ENABLE_CONSOLE_LOGGING === 'true',
  },

  // API Configuration
  api: {
    prefix: process.env.API_PREFIX || '/api',
    enableCors: process.env.ENABLE_CORS === 'true',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Health Check
  healthCheck: {
    endpoint: process.env.HEALTH_CHECK_ENDPOINT || '/health',
  },

  // Database Configuration - Docker or AWS RDS
  database: {
    provider: process.env.DB_PROVIDER || 'docker', // 'docker' or 'aws-rds'
    host: process.env.DB_HOST || (process.env.DB_PROVIDER === 'docker' ? 'localhost' : ''),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'test_asg_db',
    user: process.env.DB_USER || 'mysql_user',
    password: process.env.DB_PASSWORD || 'mysql_password',
    type: process.env.DB_TYPE || 'mysql',
    ssl: process.env.DB_SSL === 'true' || process.env.DB_PROVIDER === 'aws-rds',
    url: process.env.DATABASE_URL || null,
    // Docker specific settings
    docker: {
      containerName: process.env.DB_DOCKER_CONTAINER || 'test-asg-mysql',
      image: process.env.DB_DOCKER_IMAGE || 'mysql:8.0',
      autoStart: process.env.DB_DOCKER_AUTO_START === 'true'
    },
    // AWS RDS specific settings
    rds: {
      endpoint: process.env.AWS_RDS_ENDPOINT || '',
      region: process.env.AWS_RDS_REGION || 'us-east-1',
      sslMode: process.env.AWS_RDS_SSL_MODE || 'require'
    }
  },

  // Redis Configuration (for future use)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },

  // JWT Configuration (for future use)
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // External Services
  external: {
    apiUrl: process.env.EXTERNAL_API_URL || '',
    apiKey: process.env.EXTERNAL_API_KEY || '',
  },

  // Monitoring & Observability
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
  },

  // Feature Flags
  features: {
    enableUserManagement: process.env.ENABLE_USER_MANAGEMENT !== 'false',
    enableAdvancedLogging: process.env.ENABLE_ADVANCED_LOGGING === 'true',
  },
};

/**
 * Validate required configuration
 */
const validateConfig = (): void => {
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Using default values...');
  }

  // Validate port
  if (isNaN(config.app.port) || config.app.port < 1 || config.app.port > 65535) {
    throw new Error(`Invalid port number: ${config.app.port}`);
  }

  // Validate environment
  const validEnvs = ['development', 'staging', 'production', 'test'];
  if (!validEnvs.includes(config.app.env)) {
    console.warn(`Warning: Unknown environment '${config.app.env}'. Using 'development'.`);
    config.app.env = 'development';
  }
};

/**
 * Get configuration for current environment
 */
const getConfig = (): Config => {
  validateConfig();
  return config;
};

/**
 * Check if running in production
 */
const isProduction = (): boolean => {
  return config.app.env === 'production';
};

/**
 * Check if running in development
 */
const isDevelopment = (): boolean => {
  return config.app.env === 'development';
};

/**
 * Check if running in staging
 */
const isStaging = (): boolean => {
  return config.app.env === 'staging';
};

/**
 * Get database connection string
 */
const getDatabaseUrl = (): string => {
  return `${config.database.type}://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`;
};

export {
  getConfig,
  isProduction,
  isDevelopment,
  isStaging,
  getDatabaseUrl,
};

export default getConfig();
