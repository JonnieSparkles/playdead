// Git operations for deployment versioning
// Handles basic git operations for commit information and file hashing

import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import { normalizePath } from './utils.js';
import { logger } from './logger.js';

// Git lock file to prevent concurrent operations
const GIT_LOCK_FILE = '.git/deployment.lock';

// Ensure git lock is released on process exit
process.on('exit', () => {
  try {
    const lockPath = path.join(process.cwd(), GIT_LOCK_FILE);
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch (error) {
    // Ignore errors during exit cleanup
  }
});

process.on('SIGINT', () => {
  try {
    const lockPath = path.join(process.cwd(), GIT_LOCK_FILE);
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch (error) {
    // Ignore errors during signal cleanup
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  try {
    const lockPath = path.join(process.cwd(), GIT_LOCK_FILE);
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch (error) {
    // Ignore errors during signal cleanup
  }
  process.exit(0);
});

export class GitTracker {
  constructor(appId, appPath) {
    this.appId = appId;
    this.appPath = appPath;
    this.appRelativePath = path.relative(process.cwd(), appPath);
    this.dir = process.cwd();
  }

  // ---------- Git Safety Methods ----------

  async acquireGitLock() {
    const lockPath = path.join(this.dir, GIT_LOCK_FILE);
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Try to create lock file exclusively
        const fd = await fs.promises.open(lockPath, 'wx');
        await fd.write(process.pid.toString());
        await fd.close();
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock exists, check if it's stale
          try {
            const lockContent = await fs.promises.readFile(lockPath, 'utf8');
            const lockPid = parseInt(lockContent.trim());
            
            // Check if the process is still running (Unix only)
            if (process.platform !== 'win32') {
              try {
                process.kill(lockPid, 0); // Signal 0 just checks if process exists
                // Process exists, wait and retry
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
              } catch {
                // Process doesn't exist, remove stale lock
                await fs.promises.unlink(lockPath);
                continue;
              }
            } else {
              // On Windows, just wait and retry
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
          } catch {
            // Can't read lock file, remove it and retry
            try {
              await fs.promises.unlink(lockPath);
            } catch {}
            continue;
          }
        }
        throw error;
      }
    }
    
    throw new Error('Could not acquire git lock after maximum retries');
  }

  async releaseGitLock() {
    const lockPath = path.join(this.dir, GIT_LOCK_FILE);
    try {
      await fs.promises.unlink(lockPath);
    } catch (error) {
      // Ignore errors when releasing lock
    }
  }

  async validateGitState() {
    try {
      // Check if we're in a git repository using a simpler approach
      const gitDirPath = path.join(process.cwd(), '.git');
      if (!fs.existsSync(gitDirPath)) {
        throw new Error('Not in a git repository');
      }

      // Check for uncommitted changes that might conflict
      const status = await git.status({ 
        fs: fs, 
        dir: this.dir,
        filepath: '.'  // filepath parameter required for git.status
      });
      const hasUncommittedChanges = Object.values(status).some(files => files.length > 0);
      
      // Note: We don't warn about uncommitted changes as the deployment system
      // is designed to handle them gracefully

      return true;
    } catch (error) {
      throw new Error(`Git state validation failed: ${error.message}`);
    }
  }

  // ---------- Commit Information ----------

  async getCurrentCommitHash() {
    try {
      const hash = await git.resolveRef({ fs, dir: this.dir, ref: 'HEAD' });
      return hash;
    } catch (error) {
      throw new Error(`Failed to get current commit hash: ${error.message}`);
    }
  }

  async getShortCommitHash() {
    const fullHash = await this.getCurrentCommitHash();
    return fullHash.substring(0, 16);
  }

  async getCommitMessage(commitHash = null) {
    try {
      const hash = commitHash || await this.getCurrentCommitHash();
      const commit = await git.readCommit({ fs, dir: this.dir, oid: hash });
      return commit.commit.message;
    } catch (error) {
      return 'Unknown commit';
    }
  }

  async getCommitInfo(commitHash = null) {
    try {
      const hash = commitHash || await this.getCurrentCommitHash();
      const commit = await git.readCommit({ fs, dir: this.dir, oid: hash });
      
      return {
        fullHash: commit.oid,
        shortHash: commit.oid.substring(0, 16),
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: new Date(commit.commit.author.timestamp * 1000)
      };
    } catch (error) {
      return {
        fullHash: commitHash || 'unknown',
        shortHash: (commitHash || 'unknown').substring(0, 16),
        message: 'Unknown commit',
        author: 'Unknown',
        date: new Date()
      };
    }
  }

  // ---------- File Operations ----------

  async getAllAppFiles() {
    try {
      const files = await git.listFiles({ fs, dir: this.dir });
      
      const appFiles = files
        .filter(file => file.startsWith(this.appRelativePath))
        .map(file => path.resolve(this.dir, file))
        .filter(file => !this.isTrackingFile(file));
      
      // Filter out directories
      const deployableFiles = [];
      for (const file of appFiles) {
        if (await this.isDeployableFile(file)) {
          deployableFiles.push(file);
        }
      }

      return deployableFiles;
    } catch (error) {
      throw new Error(`Failed to get all app files: ${error.message}`);
    }
  }

  async getFileHash(filePath) {
    try {
      const content = await fs.promises.readFile(filePath);
      const hash = await git.hashBlob({ object: content });
      // hashBlob returns an object with oid property - we need just the hash string
      return typeof hash === 'string' ? hash : hash.oid || hash;
    } catch (error) {
      throw new Error(`Failed to get file hash for ${filePath}: ${error.message}`);
    }
  }

  async isFileTracked(filePath) {
    try {
      const relativePath = normalizePath(path.relative(this.dir, filePath));
      const files = await git.listFiles({ fs, dir: this.dir });
      
      // Normalize all git-tracked files for consistent comparison
      const normalizedFiles = files.map(f => normalizePath(f));
      
      return normalizedFiles.includes(relativePath);
    } catch {
      return false;
    }
  }

  async isDeployableFile(filePath) {
    try {
      const stat = await fs.promises.stat(filePath);
      return !stat.isDirectory();
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        logger.warning(`Permission denied accessing ${filePath} - skipping`);
        return false; // Skip files we can't access
      }
      // For other errors (file not found, etc.), also skip
      return false;
    }
  }

  isTrackingFile(filePath) {
    const fileName = path.basename(filePath);
    return fileName === 'manifest.json' || 
           fileName === 'deployment-tracker.json' ||
           fileName === 'upload-tags.json';
  }

  // ---------- Repository Information ----------

  async isGitRepository() {
    try {
      await git.findRoot({ fs, filepath: process.cwd() });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getRepositoryInfo() {
    try {
      const remoteUrl = await git.getConfig({ fs, dir: this.dir, path: 'remote.origin.url' });
      const branch = await git.currentBranch({ fs, dir: this.dir });
      
      return {
        remoteUrl: remoteUrl || null,
        branch: branch || null,
        isGitRepo: true
      };
    } catch (error) {
      return {
        remoteUrl: null,
        branch: null,
        isGitRepo: false
      };
    }
  }

  // ---------- Deployment History ----------

  async findLastDeployCommit() {
    try {
      // Look for deployment commit messages
      const logs = await git.log({ fs, dir: this.dir, depth: 100 });
      
      for (const commit of logs) {
        if (commit.commit.message.includes(`Deploy app:${this.appId}`)) {
          return commit.oid;
        }
      }
      
      return null; // No previous deployment found
    } catch (error) {
      return null;
    }
  }

  async getDeploymentHistory(limit = 10) {
    try {
      const logs = await git.log({ fs, dir: this.dir, depth: 100 });
      
      const deployments = [];
      for (const commit of logs) {
        if (commit.commit.message.includes(`Deploy app:${this.appId}`)) {
          deployments.push({
            commitHash: commit.oid,
            message: commit.commit.message
          });
          
          if (deployments.length >= limit) {
            break;
          }
        }
      }

      return deployments;
    } catch (error) {
      return [];
    }
  }

  // ---------- Utility Methods ----------

  async createDeployCommit(manifestTxId, changedFiles, version) {
    let lockAcquired = false;
    
    try {
      // Acquire git lock to prevent concurrent operations
      await this.acquireGitLock();
      lockAcquired = true;
      
      // Validate git state before proceeding
      await this.validateGitState();
      
      const commitMessage = this.formatDeployCommitMessage(version, changedFiles, manifestTxId);
      
      // Ensure consistent path normalization for staging
      const manifestPath = normalizePath(`${this.appRelativePath}/manifest.json`);
      const trackerPath = normalizePath(`${this.appRelativePath}/deployment-tracker.json`);
      
      // Stage the manifest and tracker files with normalized paths
      await git.add({ 
        fs, 
        dir: this.dir, 
        filepath: manifestPath
      });
      await git.add({ 
        fs, 
        dir: this.dir, 
        filepath: trackerPath
      });
      
      // Get author info or use defaults
      let authorName = await git.getConfig({ fs, dir: this.dir, path: 'user.name' }) || 'Deployment Bot';
      let authorEmail = await git.getConfig({ fs, dir: this.dir, path: 'user.email' }) || 'deploy@agent-tests.com';
      
      // Create commit
      const commitHash = await git.commit({
        fs,
        dir: this.dir,
        author: {
          name: authorName,
          email: authorEmail
        },
        message: commitMessage
      });
      
      return commitHash;
    } catch (error) {
      throw new Error(`Failed to create deployment commit: ${error.message}`);
    } finally {
      // Always release the lock
      if (lockAcquired) {
        await this.releaseGitLock();
      }
    }
  }

  formatDeployCommitMessage(version, changedFiles, manifestTxId) {
    const fileList = changedFiles.map(f => normalizePath(path.relative(this.appPath, f))).join(', ');
    const shortTxId = manifestTxId.substring(0, 16);
    
    return `Deploy app:${this.appId} v${version}

Files changed: ${fileList}
Manifest: ${shortTxId}...
ArNS: ${this.appId}`;
  }

  async createDeployTag(version, commitHash) {
    try {
      const tagName = `deploy-${this.appId}-v${version}`;
      
      await git.tag({
        fs,
        dir: this.dir,
        ref: tagName,
        object: commitHash,
        force: false,
        tagger: {
          name: await git.getConfig({ fs, dir: this.dir, path: 'user.name' }) || 'Deployment Bot',
          email: await git.getConfig({ fs, dir: this.dir, path: 'user.email' }) || 'deploy@agent-tests.com',
          timestamp: Math.floor(Date.now() / 1000)
        }
      });
      
      return tagName;
    } catch (error) {
      throw new Error(`Failed to create deployment tag: ${error.message}`);
    }
  }
}
