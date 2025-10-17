// Dynamic deployment system for Arweave apps
// Handles uploading only changed files and updating manifests

import { ManifestManager } from './manifest-manager.js';
import { GitTracker } from './git-tracker.js';
import { uploadToArweave, loadWallet } from './arweave.js';
import { createUndernameRecord, getUndernameRecord, setRootRecord } from './arns.js';
import { readFile, readFileBinary, isBinaryFile, formatBytes, guessContentType, loadConfig, normalizePath } from './utils.js';
import { AoANTWriteable } from '@ar.io/sdk';
import { logger } from './logger.js';
import path from 'path';

export class DynamicDeployer {
  constructor(appId, appPath) {
    this.appId = appId;
    this.appPath = appPath;
    this.manifestManager = new ManifestManager(appId, appPath);
    this.gitTracker = new GitTracker(appId, appPath);
  }

  // ---------- Main Deployment Method ----------

  async deploy(testMode = false, options = {}) {
    logger.info(`🚀 Starting dynamic deployment for app: ${this.appId}`);
    
    try {
      // 1. Validate git repository
      if (!(await this.gitTracker.isGitRepository())) {
        throw new Error('Not in a git repository. Dynamic deployment requires git.');
      }

      // 2. Get current commit info
      const commitInfo = await this.gitTracker.getCommitInfo();
      logger.showCommitInfo(commitInfo.shortHash, commitInfo.message);

      // 3. Get last deployment info from deployment tracker
      const currentTracker = await this.manifestManager.loadDeploymentTracker();
      const lastDeployCommit = currentTracker.lastDeployCommit;
      logger.info(`🔍 Last deployment commit: ${lastDeployCommit || 'none (first deployment)'}`);

      // 4. Find changed files using hash-based detection
      const { changedFiles, currentFiles } = await this.manifestManager.getChangedFilesByHash(this.gitTracker);
      logger.showChangedFiles(changedFiles.length);

      if (changedFiles.length === 0) {
        logger.showNoChanges();
        return {
          success: true,
          skipped: true,
          reason: 'no_changes',
          appId: this.appId,
          commitHash: commitInfo.shortHash
        };
      }

      // 5. Load current manifest
      const currentManifest = await this.manifestManager.loadManifest();

      // 6. Upload changed files
      logger.showStaticProgress(`📤 Uploading ${changedFiles.length} changed files...`);
      const { newFileIds, fileHashes } = await this.uploadChangedFiles(changedFiles, testMode);
      logger.clearSpinner();
      logger.success(`Uploaded ${changedFiles.length} files successfully`);

      // 7. Update manifest with new file IDs (and remove deleted files)
      const updatedManifest = await this.updateManifestWithNewFiles(currentManifest, newFileIds, currentFiles);
      logger.showManifestUpdate(Object.keys(newFileIds).length);

      // 8. Upload updated manifest
      logger.startSpinner('☁️ Uploading manifest to Arweave...');
      const manifestTxId = await this.uploadManifest(updatedManifest, testMode);
      logger.succeedSpinner(`Manifest uploaded: ${manifestTxId}`);

      // 9. Create or update ArNS record
      logger.showStaticProgress(`🔗 Creating ArNS record: ${commitInfo.shortHash} → ${manifestTxId}`);
      const undername = await this.createArNSRecord(commitInfo.shortHash, manifestTxId, testMode, options);
      logger.clearSpinner();
      logger.success(`ArNS record created: ${undername}`);

      // 10. Update deployment tracker
      await this.manifestManager.updateDeploymentTracker(
        commitInfo.shortHash,
        manifestTxId,
        changedFiles,
        fileHashes,
        currentFiles
      );

      // 11. Save updated manifest locally
      await this.manifestManager.saveManifest(updatedManifest);

      // 12. Create deployment commit (if not in test mode)
      // Note: In CI environments, we rely on the GitHub Actions workflow to commit these files
      if (!testMode) {
        const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
        if (!isCI) {
          await this.gitTracker.createDeployCommit(manifestTxId, changedFiles, updatedManifest.version);
          logger.success('📝 Created deployment commit');
        } else {
          logger.info('📝 Deployment files written - will be committed by GitHub Actions workflow');
        }
      }

      // 13. Calculate deployment stats
      const stats = await this.calculateDeploymentStats(changedFiles, newFileIds, currentFiles);

      return {
        success: true,
        appId: this.appId,
        version: updatedManifest.version,
        commitHash: commitInfo.shortHash,
        manifestTxId: manifestTxId,
        undername: undername,
        changedFiles: changedFiles,
        newFileIds: newFileIds,
        stats: stats,
        testMode: testMode
      };

    } catch (error) {
      logger.showError('Dynamic deployment failed', error);
      return {
        success: false,
        error: error.message,
        appId: this.appId
      };
    }
  }

  // ---------- File Upload Methods ----------

  async uploadChangedFiles(changedFiles, testMode = false) {
    const fileIds = {};
    const fileHashes = {};
    const wallet = await loadWallet();

    for (let i = 0; i < changedFiles.length; i++) {
      const filePath = changedFiles[i];
      const relativePath = normalizePath(path.relative(this.appPath, filePath));
      
      logger.showFileUpload(relativePath, i, changedFiles.length);
      
      try {
        const isBinary = isBinaryFile(filePath);
        const fileContent = isBinary ? await readFileBinary(filePath) : await readFile(filePath);
        const fileSize = isBinary ? fileContent.length : Buffer.byteLength(fileContent, 'utf8');
        
        // Calculate file hash for tracking
        const fileHash = await this.gitTracker.getFileHash(filePath);
        fileHashes[relativePath] = fileHash;
        
        if (testMode) {
          // In test mode, generate mock transaction ID
          const mockTxId = `test-${Date.now()}-${i}`;
          fileIds[filePath] = mockTxId;
          logger.success(`Test upload: ${mockTxId}`);
        } else {
          const contentType = guessContentType(filePath);
          const config = loadConfig();
          const txId = await uploadToArweave(
            isBinary ? fileContent : Buffer.from(fileContent, 'utf-8'),
            contentType,
            config.appName,
            wallet
          );
          fileIds[filePath] = txId;
        }
      } catch (error) {
        throw new Error(`Failed to upload ${relativePath}: ${error.message}`);
      }
    }

    return { newFileIds: fileIds, fileHashes };
  }

  async uploadManifest(manifest, testMode = false) {
    const wallet = await loadWallet();
    const manifestContent = JSON.stringify(manifest, null, 2);
    
    if (testMode) {
      return `test-manifest-${Date.now()}`;
    }
    
    // Upload manifest as JSON file directly (don't use the uploadManifest helper which expects pathMap)
    const config = loadConfig();
    return await uploadToArweave(
      Buffer.from(manifestContent, 'utf-8'),
      'application/x.arweave-manifest+json',
      config.appName,
      wallet,
      [{ name: 'Type', value: 'manifest' }]
    );
  }

  // ---------- Manifest Management ----------

  async updateManifestWithNewFiles(currentManifest, newFileIds, currentFiles) {
    const updatedManifest = { ...currentManifest };
    
    // Keep manifest specification version fixed at 0.2.0
    updatedManifest.version = "0.2.0";
    
    // Update index path to correct entry point if needed
    const correctEntryPoint = await this.manifestManager.getEntryPoint();
    if (updatedManifest.index?.path !== correctEntryPoint) {
      logger.info(`📝 Updating index path from "${updatedManifest.index?.path}" to "${correctEntryPoint}"`);
      updatedManifest.index = { path: correctEntryPoint };
    }
    
    // Convert current files to relative paths for comparison
    const currentRelativePaths = new Set(
      currentFiles.map(f => normalizePath(path.relative(this.appPath, f)))
    );
    
    // Clean up existing manifest - keep only files that still exist
    const cleanedPaths = {};
    for (const [relativePath, fileData] of Object.entries(updatedManifest.paths)) {
      // Keep the entry if:
      // 1. It's not a tracking file AND
      // 2. The file still exists in current tracked files
      if (!this.isTrackingFile(path.join(this.appPath, relativePath)) && 
          currentRelativePaths.has(relativePath)) {
        cleanedPaths[relativePath] = fileData;
      }
    }
    updatedManifest.paths = cleanedPaths;
    
    // Update paths with new file IDs (only non-tracking files)
    for (const [filePath, txId] of Object.entries(newFileIds)) {
      const relativePath = normalizePath(path.relative(this.appPath, filePath));
      if (!this.isTrackingFile(filePath)) {
        updatedManifest.paths[relativePath] = { id: txId };
      }
    }
    
    // Add manual TXID overrides
    const manualOverrides = await this.manifestManager.loadManualOverrides();
    for (const [relativePath, txId] of Object.entries(manualOverrides)) {
      updatedManifest.paths[relativePath] = { id: txId };
      logger.info(`🔗 Added manual override: ${relativePath} → ${txId}`);
    }
    
    return updatedManifest;
  }

  isTrackingFile(filePath) {
    const fileName = path.basename(filePath);
    return fileName === 'manifest.json' || 
           fileName === 'deployment-tracker.json' ||
           fileName === 'manifest-overrides.json';
  }

  // ---------- ArNS Management ----------

  async createArNSRecord(commitHash, manifestTxId, testMode = false, options = {}) {
    try {
      if (testMode) {
        const recordType = options.useRootName ? 'root record (@)' : 'undername';
        const recordName = options.useRootName ? 
          'root' : 
          (options.customUndername || commitHash);
        logger.info(`🧪 Test mode: Would create ArNS ${recordType} ${recordName} → ${manifestTxId}`);
        return options.useRootName ? 
          loadConfig().rootArnsName : 
          (options.customUndername || commitHash);
      }

      const config = loadConfig();
      const wallet = await loadWallet();
      const ant = new AoANTWriteable({ 
        processId: config.antProcessId,
        signer: wallet
      });

      if (options.useRootName) {
        // Set the root record (@) to point to manifest TX ID
        const result = await setRootRecord(ant, manifestTxId, 60);
        if (result.success) {
          logger.success(`Root record (@) set to ${manifestTxId}`);
          return config.rootArnsName;
        } else {
          throw new Error(`Root record creation failed: ${result.message}`);
        }
      } else {
        // Use custom undername if provided, otherwise use commitHash
        const undername = options.customUndername || commitHash;
        
        // Check if record already exists
        const existingRecord = await getUndernameRecord(ant, undername);
        if (existingRecord) {
          const fullUndername = `${undername}_${config.rootArnsName}`;
          logger.warning(`⚠️ ArNS record already exists for ${fullUndername}`);
          return fullUndername;
        }

        // Create new undername record
        const result = await createUndernameRecord(ant, undername, manifestTxId, 60);
        if (result.success) {
          const fullUndername = `${undername}_${config.rootArnsName}`;
          return fullUndername;
        } else {
          throw new Error(`ArNS record creation failed: ${result.message}`);
        }
      }
    } catch (error) {
      logger.showError('ArNS record creation failed', error);
      logger.warning(`⚠️ Deployment will continue without ArNS record. The manifest is still accessible at: ${manifestTxId}`);
      logger.info(`💡 You can manually create the ArNS record later if needed.`);
      
      return options.useRootName ? 
        loadConfig().rootArnsName : 
        (options.customUndername || commitHash);
    }
  }

  // ---------- Statistics and Reporting ----------

  async calculateDeploymentStats(changedFiles, newFileIds, currentFiles = []) {
    let totalSize = 0;
    
    for (const filePath of changedFiles) {
      try {
        const isBinary = isBinaryFile(filePath);
        const content = isBinary ? await readFileBinary(filePath) : await readFile(filePath);
        totalSize += isBinary ? content.length : Buffer.byteLength(content, 'utf8');
      } catch (error) {
        logger.warning(`⚠️ Could not calculate size for ${filePath}: ${error.message}`);
      }
    }

    const unchangedFiles = currentFiles.length - changedFiles.length;

    return {
      totalSize: totalSize,
      fileCount: changedFiles.length,
      unchangedFiles: unchangedFiles,
      newFileIds: Object.keys(newFileIds).length
    };
  }

  // ---------- Utility Methods ----------

  async getDeploymentInfo() {
    const manifest = await this.manifestManager.loadManifest();
    const tracker = await this.manifestManager.loadDeploymentTracker();
    const commitInfo = await this.gitTracker.getCommitInfo();
    
    return {
      appId: this.appId,
      version: manifest.version,
      entryPoint: manifest.index?.path,
      fileCount: Object.keys(manifest.paths).length,
      lastDeployed: tracker.lastDeployed,
      deploymentCount: tracker.deploymentCount,
      lastDeployCommit: tracker.lastDeployCommit,
      currentCommit: commitInfo.shortHash,
      currentCommitMessage: commitInfo.message
    };
  }

  async getDeploymentHistory() {
    return await this.gitTracker.getDeploymentHistory();
  }

  async validateApp() {
    try {
      // Use the same file discovery logic as deployment
      const { changedFiles, currentFiles } = await this.manifestManager.getChangedFilesByHash(this.gitTracker);
      
      // For new apps, currentFiles should contain all git-tracked files
      if (currentFiles.length === 0) {
        throw new Error(`No git-tracked files found in ${this.appPath}`);
      }

      // Check if entry point exists
      await this.manifestManager.getEntryPoint();

      return {
        valid: true,
        appId: this.appId,
        appPath: this.appPath
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        appId: this.appId,
        appPath: this.appPath
      };
    }
  }
}
