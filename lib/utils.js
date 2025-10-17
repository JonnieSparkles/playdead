// Utility functions for the remote agent deployment system

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

// ---------- Hash and commit functions ----------
export function generateCommitHash(content, timestamp = null) {
  const time = timestamp || new Date().toISOString();
  const data = `${content}\n${time}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateShortHash(fullHash) {
  return fullHash.substring(0, 16);
}

// ---------- Path normalization ----------
export function normalizePath(filePath) {
  if (typeof filePath !== 'string') return filePath;
  // Convert backslashes to forward slashes and remove double slashes
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// ---------- File operations ----------
export async function readFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    logger.showError(`Error reading file ${filePath}`, error);
    throw error;
  }
}

export async function readFileBinary(filePath) {
  try {
    const content = await fs.readFile(filePath); // No encoding = binary
    return content;
  } catch (error) {
    logger.showError(`Error reading binary file ${filePath}`, error);
    throw error;
  }
}

export function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const binaryExtensions = [
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff', '.tif',
    // Fonts
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    // Archives
    '.zip', '.rar', '.7z', '.tar', '.gz',
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    // Media
    '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
    // Executables
    '.exe', '.dll', '.so', '.dylib',
    // Other binary formats
    '.bin', '.dat', '.db', '.sqlite', '.sqlite3'
  ];
  return binaryExtensions.includes(ext);
}

export async function writeFile(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    logger.success(`File written: ${filePath}`);
  } catch (error) {
    logger.showError(`Error writing file ${filePath}`, error);
    throw error;
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listDir(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => entry.name);
  } catch (error) {
    logger.showError(`Error listing directory ${dirPath}`, error);
    throw error;
  }
}

export async function isDirectory(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function getAllFilesInDirectory(dirPath, relativeTo = null) {
  // Recursively get all files in a directory
  // Returns an array of file paths relative to the dirPath
  const basePath = relativeTo || dirPath;
  const files = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively get files from subdirectory
        const subFiles = await getAllFilesInDirectory(fullPath, basePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Get relative path from base
        const relativePath = path.relative(basePath, fullPath);
        files.push({
          absolutePath: fullPath,
          relativePath: normalizePath(relativePath), // Normalize path and remove double slashes
          name: entry.name
        });
      }
    }
    
    return files;
  } catch (error) {
    logger.showError(`Error getting files from ${dirPath}`, error);
    throw error;
  }
}

// ---------- Content type detection ----------
export function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    // Text files
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
    
    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    
    // Fonts
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    
    // Archives
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    
    // Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Media
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.webm': 'video/webm',
    
    // Other
    '.bin': 'application/octet-stream',
    '.dat': 'application/octet-stream',
    '.db': 'application/octet-stream',
    '.sqlite': 'application/x-sqlite3',
    '.sqlite3': 'application/x-sqlite3'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

// ---------- Environment and configuration ----------
export function loadConfig() {
  const config = {
    // ArNS Configuration
    antProcessId: process.env.ANT_PROCESS_ID,
    rootArnsName: process.env.ROOT_ARNS_NAME,
    walletAddress: process.env.WALLET_ADDRESS,
    
    // Wallet Configuration (supports both file path and raw JSON)
    walletPath: process.env.ARWEAVE_WALLET_PATH || './secrets/wallet.json',
    walletJson: process.env.ARWEAVE_JWK_JSON,
    
    // TTL Configuration (supports both naming conventions)
    arnsTtl: parseInt(process.env.ARNS_UNDERNAME_TTL) || 
             parseInt(process.env.DEFAULT_TTL_SECONDS) || 
             60, // 60 seconds default
    
    // Turbo Configuration
    turboPaymentUrl: process.env.TURBO_PAYMENT_SERVICE_URL || 'https://payment.ardrive.dev',
    turboUploadUrl: process.env.TURBO_UPLOAD_SERVICE_URL || 'https://upload.ardrive.dev',
    
    // Shared Credits Configuration
    // Enable automatic shared credits usage (SDK will automatically use approvals closest to expiration,
    // then lowest amounts, then fall back to signer's balance)
    useSharedCredits: process.env.TURBO_USE_SHARED_CREDITS === 'true' || 
                     process.env.TURBO_USE_SHARED_CREDITS === '1',
    
    // Wallet addresses that have shared credits with this wallet (comma-separated)
    sharedCreditsPaidBy: process.env.TURBO_SHARED_CREDITS_PAID_BY ? 
      process.env.TURBO_SHARED_CREDITS_PAID_BY.split(',').map(addr => addr.trim()) : 
      null,
    
    // Application Configuration
    appName: process.env.APP_NAME || 'RemoteAgentDeploy',
    arweaveGateway: process.env.ARWEAVE_GATEWAY || 'https://arweave.net',
    
    // Optional Server Configuration
    port: parseInt(process.env.PORT) || 3000,
    
    
    // Discord Configuration
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL
  };

  // Validate required config
  if (!config.antProcessId) {
    throw new Error('ANT_PROCESS_ID environment variable is required');
  }
  
  if (!config.rootArnsName) {
    throw new Error('ROOT_ARNS_NAME environment variable is required');
  }

  return config;
}

// ---------- Logging and formatting ----------
import { logDeployment } from './logging.js';

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export async function logDeploymentResult(result, deploymentStats = null) {
  logger.newLine();
  
  if (result.success) {
    logger.success('🎉 Deployment complete!');
    logger.info(`   File: ${result.filePath || 'N/A'}`);
    logger.info(`   Commit: ${result.commitHash || 'N/A'}`);
    logger.info(`   TX ID: ${result.txId || 'N/A'}`);
    
    // Format ArNS with root name if available
    let arnsDisplay = result.undername || 'N/A';
    if (result.undername && result.rootArnsName) {
      arnsDisplay = `${result.undername}_${result.rootArnsName}`;
    }
    logger.info(`   ArNS: ${arnsDisplay}`);
    
    logger.info(`   Size: ${formatBytes(result.fileSize || 0)}`);
    logger.info(`   Duration: ${formatDuration(result.duration || 0)}`);
  } else {
    logger.error('❌ Deployment failed!');
    logger.info(`   File: ${result.filePath || 'N/A'}`);
    logger.info(`   Error: ${result.error || 'Unknown error'}`);
    logger.info(`   Duration: ${formatDuration(result.duration || 0)}`);
  }
  
  // Log to JSON file
  await logDeployment(result);
  
  // Note: Deployment summary table is now shown explicitly in deployment functions
  // to ensure it appears last in the output
}

// ---------- Error handling ----------
export function handleError(error, context = '') {
  logger.showError(`${context}Error`, error);
  if (error.stack && process.env.NODE_ENV === 'development') {
    logger.error(error.stack);
  }
  return {
    success: false,
    error: error.message,
    context
  };
}

// ---------- Validation ----------
export function validateFileContent(content) {
  if (typeof content !== 'string') {
    throw new Error('File content must be a string');
  }
  if (content.length === 0) {
    throw new Error('File content cannot be empty');
  }
  if (content.length > 10 * 1024 * 1024) { // 10MB limit
    throw new Error('File content too large (max 10MB)');
  }
  return true;
}

export function validateFilePath(filePath) {
  if (typeof filePath !== 'string') {
    throw new Error('File path must be a string');
  }
  if (filePath.includes('..') || filePath.startsWith('/')) {
    throw new Error('File path must be relative and not contain parent directory references');
  }
  return true;
}
