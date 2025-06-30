#!/usr/bin/env node

/**
 * Start application with AWS Secrets Manager credentials
 * 
 * This script fetches database credentials from AWS Secrets Manager
 * and starts the application with those credentials as environment variables.
 * 
 * For local development with Docker, it can also use local environment variables.
 */

import { spawn, ChildProcess } from 'child_process';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Define interface for AWS Secret
interface DbSecret {
  username: string;
  password: string;
  dbname: string;
  host?: string;
  port?: string;
  engine?: string;
}

// Determine if we're running in local Docker mode or AWS mode
const isLocalDocker = process.env.USE_LOCAL_DOCKER === 'true';
const isAwsMode = !isLocalDocker && (process.env.NODE_ENV === 'production' || process.env.USE_AWS_SECRETS === 'true');

/**
 * Start the application with the given environment variables
 */
function startApplication(additionalEnv: Record<string, string> = {}): void {
  console.log(`Starting application in ${process.env.NODE_ENV} mode...`);
  
  // Merge environment variables
  const env = { ...process.env, ...additionalEnv };
  
  // Log database connection info (without sensitive data)
  if (env.SECRETS_DB_USER) {
    console.log(`Database connection: ${env.SECRETS_DB_USER}@${env.AWS_RDS_ENDPOINT || env.DB_HOST}:${env.DB_PORT}/${env.SECRETS_DB_NAME}`);
  }
  
  // Start the application
  const nodeProcess: ChildProcess = spawn('node', ['dist/server.js'], {
    stdio: 'inherit',
    env: env
  });
  
  // Handle process events
  nodeProcess.on('close', (code) => {
    console.log(`Application exited with code ${code}`);
    process.exit(code || 0);
  });
  
  nodeProcess.on('error', (err) => {
    console.error('Failed to start application:', err);
    process.exit(1);
  });
  
  // Handle termination signals
  process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down gracefully...');
    nodeProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Shutting down gracefully...');
    nodeProcess.kill('SIGTERM');
  });
}

/**
 * Start the application in local Docker mode
 */
function startLocalDockerMode(): void {
  console.log('Starting in local Docker mode with local database...');
  startApplication();
}

/**
 * Start the application in AWS mode with Secrets Manager
 */
function startAwsMode(): void {
  // Get the secret name from environment variables
  const secretName = process.env.AWS_SECRET_NAME || 'anup-training-dev-db-credentials';
  const region = process.env.AWS_RDS_REGION || 'us-east-1';
  
  console.log(`Fetching database credentials from AWS Secrets Manager (${secretName})...`);
  
  // Create a Secrets Manager client
  const secretsManager = new AWS.SecretsManager({
    region: region
  });
  
  // Fetch the secret
  secretsManager.getSecretValue({ SecretId: secretName }, (err, data) => {
    if (err) {
      console.error('Error retrieving secret from AWS Secrets Manager:', err);
      console.error('Error details:', err.code, err.message);
      
      // If we're in development mode and AWS credentials failed, fall back to local
      if (process.env.NODE_ENV === 'development') {
        console.log('Falling back to local database configuration...');
        startLocalDockerMode();
        return;
      }
      
      process.exit(1);
    }
    
    try {
      // Parse the secret
      const secretString = data.SecretString;
      if (!secretString) {
        throw new Error('Secret string is empty');
      }
      
      const secret: DbSecret = JSON.parse(secretString);
      
      console.log('Successfully retrieved database credentials from AWS Secrets Manager');
      
      // Set additional environment variables
      const additionalEnv: Record<string, string> = {
        SECRETS_DB_USER: secret.username,
        SECRETS_DB_PASSWORD: secret.password,
        SECRETS_DB_NAME: secret.dbname,
        AWS_RDS_ENDPOINT: secret.host || process.env.AWS_RDS_ENDPOINT || '',
        DB_PORT: secret.port || process.env.DB_PORT || '3306',
        DB_PROVIDER: 'aws-rds'
      };
      
      // Start the application with the additional environment variables
      startApplication(additionalEnv);
      
    } catch (parseError) {
      console.error('Error parsing secret:', parseError);
      process.exit(1);
    }
  });
}

// Determine which mode to start in
if (isAwsMode) {
  startAwsMode();
} else {
  startLocalDockerMode();
}
