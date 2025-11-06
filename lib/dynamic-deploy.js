// Dynamic deployment system for Arweave apps
// Handles uploading only changed files and updating manifests

import { ManifestManager } from './manifest-manager.js';
import { GitTracker } from './git-tracker.js';
import { uploadToArweave, loadWallet } from './arweave.js';
import { createUndernameRecord, updateUndernameRecord, getUndernameRecord, setRootRecord } from './arns.js';
import { readFile, readFileBinary, isBinaryFile, formatBytes, guessContentType, loadConfig, normalizePath, fileExists } from './utils.js';
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
      const { newFileIds, fileHashes, uploadedCount } = await this.uploadChangedFiles(changedFiles, testMode);
      logger.clearSpinner();
      if (uploadedCount > 0) {
        logger.success(`Uploaded ${uploadedCount} files successfully`);
      } else {
        logger.info(`No files to upload (all changed files were excluded)`);
      }

      // 7. Update manifest with new file IDs (and remove deleted files)
      const updatedManifest = await this.updateManifestWithNewFiles(currentManifest, newFileIds, currentFiles);
      if (uploadedCount > 0) {
        logger.showManifestUpdate(Object.keys(newFileIds).length);
      }

      // 8. Upload updated manifest
      logger.startSpinner('☁️ Uploading manifest to Arweave...');
      const manifestTxId = await this.uploadManifest(updatedManifest, testMode);
      logger.succeedSpinner(`Manifest uploaded: ${manifestTxId}`);

      // 9. Create or update ArNS record
      const displayName = options.customUndername || (options.useRootName ? '@' : commitInfo.shortHash);
      logger.showStaticProgress(`🔗 Setting ArNS record: ${displayName} → ${manifestTxId}`);
      const undername = await this.createArNSRecord(commitInfo.shortHash, manifestTxId, testMode, options);
      logger.clearSpinner();
      logger.success(`ArNS record set: ${undername}`);

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

    // Filter out files that shouldn't be uploaded
    const uploadableFiles = changedFiles.filter(f => !this.isUploadExcludedFile(f));

    for (let i = 0; i < uploadableFiles.length; i++) {
      const filePath = uploadableFiles[i];
      const relativePath = normalizePath(path.relative(this.appPath, filePath));
      
      logger.showFileUpload(relativePath, i, uploadableFiles.length);
      
      try {
        const isBinary = isBinaryFile(filePath);
        const fileContent = isBinary ? await readFileBinary(filePath) : await readFile(filePath);
        const fileSize = isBinary ? fileContent.length : Buffer.byteLength(fileContent, 'utf8');
        
        // Calculate file hash for tracking and tagging
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
          
          // Add file hash as a custom tag
          const customTags = [
            { name: 'File-Hash-SHA256', value: fileHash }
          ];
          
          const txId = await uploadToArweave(
            isBinary ? fileContent : Buffer.from(fileContent, 'utf-8'),
            contentType,
            null,
            wallet,
            customTags,
            this.appPath
          );
          fileIds[filePath] = txId;
        }
      } catch (error) {
        throw new Error(`Failed to upload ${relativePath}: ${error.message}`);
      }
    }
    
    // Track hashes for ALL changed files (including manifest-overrides.json)
    for (const filePath of changedFiles) {
      const relativePath = normalizePath(path.relative(this.appPath, filePath));
      
      // Reuse hash if already calculated for uploadable files, otherwise calculate it
      if (fileHashes[relativePath]) {
        // Hash already calculated during upload
        continue;
      } else {
        // Calculate hash for non-uploadable files (like manifest-overrides.json)
        const fileHash = await this.gitTracker.getFileHash(filePath);
        fileHashes[relativePath] = fileHash;
      }
    }

    return { newFileIds: fileIds, fileHashes, uploadedCount: uploadableFiles.length };
  }

  async uploadManifest(manifest, testMode = false) {
    const wallet = await loadWallet();
    const manifestContent = JSON.stringify(manifest, null, 2);
    
    if (testMode) {
      return `test-manifest-${Date.now()}`;
    }
    
    // Upload manifest as JSON file directly (don't use the uploadManifest helper which expects pathMap)
    return await uploadToArweave(
      Buffer.from(manifestContent, 'utf-8'),
      'application/x.arweave-manifest+json',
      null,
      wallet,
      [{ name: 'Type', value: 'manifest' }],
      this.appPath
    );
  }

  // ---------- Manifest Management ----------

  async updateManifestWithNewFiles(currentManifest, newFileIds, currentFiles) {
    const updatedManifest = { ...currentManifest };
    
    // Keep manifest specification version fixed at 0.2.0
    updatedManifest.version = "0.2.0";
    
    // Determine index path with proper priority system:
    // 1) Manual overrides (from manifest-overrides.json)
    // 2) index.html (if it exists)
    // 3) Next available file (auto-detection)
    const manualOverrides = await this.manifestManager.loadManualOverrides();
    let finalIndexPath = null;
    
    if (manualOverrides.index?.path) {
      // Priority 1: Manual override
      finalIndexPath = manualOverrides.index.path;
      logger.info(`📝 Using manual index override: "${finalIndexPath}"`);
    } else {
      // Priority 2: Check for index.html specifically
      const indexPath = path.join(this.appPath, 'index.html');
      if (await fileExists(indexPath)) {
        finalIndexPath = 'index.html';
        logger.info(`📝 Using index.html as entry point`);
      } else {
        // Priority 3: Auto-detect first available file
        const correctEntryPoint = await this.manifestManager.getEntryPoint();
        finalIndexPath = correctEntryPoint;
        logger.info(`📝 Auto-detected entry point: "${finalIndexPath}"`);
      }
    }
    
    // Update manifest with the determined index path
    if (updatedManifest.index?.path !== finalIndexPath) {
      logger.info(`📝 Setting index path to: "${finalIndexPath}"`);
      updatedManifest.index = { path: finalIndexPath };
    }
    
    // Get ALL current app files (not just changed ones) for manifest cleanup
    const allCurrentFiles = await this.manifestManager.discoverAppFiles();
    const allCurrentRelativePaths = new Set(
      allCurrentFiles.map(f => normalizePath(path.relative(this.appPath, f)))
    );
    
    // Clean up existing manifest - keep only files that still exist locally
    const cleanedPaths = {};
    for (const [relativePath, fileData] of Object.entries(updatedManifest.paths)) {
      // Keep the entry if:
      // 1. It's not a tracking file AND
      // 2. The file still exists locally
      if (!this.isUploadExcludedFile(path.join(this.appPath, relativePath)) && 
          allCurrentRelativePaths.has(relativePath)) {
        cleanedPaths[relativePath] = fileData;
      }
    }
    updatedManifest.paths = cleanedPaths;
    
    // Update paths with new file IDs (only non-tracking files)
    for (const [filePath, txId] of Object.entries(newFileIds)) {
      const relativePath = normalizePath(path.relative(this.appPath, filePath));
      if (!this.isUploadExcludedFile(filePath)) {
        updatedManifest.paths[relativePath] = { id: txId };
      }
    }
    
    // Add manual TXID overrides
    for (const [relativePath, fileData] of Object.entries(manualOverrides.paths)) {
      const txId = fileData.id;
      updatedManifest.paths[relativePath] = { id: txId };
      logger.info(`🔗 Added manual override: ${relativePath} → ${txId}`);
    }
    
    return updatedManifest;
  }

  isTrackingFile(filePath) {
    const fileName = path.basename(filePath);
    return fileName === 'manifest.json' || 
           fileName === 'deployment-tracker.json' ||
           fileName === 'upload-tags.json';
  }

  isUploadExcludedFile(filePath) {
    const fileName = path.basename(filePath);
    return fileName === 'manifest.json' || 
           fileName === 'deployment-tracker.json' ||
           fileName === 'manifest-overrides.json' ||
           fileName === 'upload-tags.json';
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

      const ttl = config.arnsTtl || 60;

      if (options.useRootName) {
        // Set the root record (@) to point to manifest TX ID
        const result = await setRootRecord(ant, manifestTxId, ttl);
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
          logger.info(`🔁 Updating existing ArNS record: ${fullUndername} → ${manifestTxId}`);
          const result = await updateUndernameRecord(ant, undername, manifestTxId, ttl);
          if (result.success) {
            return fullUndername;
          } else {
            throw new Error(`ArNS record update failed: ${result.message}`);
          }
        }

        // Create new undername record
        logger.info(`✨ Creating new ArNS record: ${undername}_${config.rootArnsName} → ${manifestTxId}`);
        const result = await createUndernameRecord(ant, undername, manifestTxId, ttl);
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
    let uploadedSize = 0;
    let totalProjectSize = 0;
    
    // Calculate size of changed files (what we actually uploaded)
    for (const filePath of changedFiles) {
      try {
        const isBinary = isBinaryFile(filePath);
        const content = isBinary ? await readFileBinary(filePath) : await readFile(filePath);
        uploadedSize += isBinary ? content.length : Buffer.byteLength(content, 'utf8');
      } catch (error) {
        logger.warning(`⚠️ Could not calculate size for ${filePath}: ${error.message}`);
      }
    }

    // Calculate total size of all files in the project
    for (const filePath of currentFiles) {
      try {
        const isBinary = isBinaryFile(filePath);
        const content = isBinary ? await readFileBinary(filePath) : await readFile(filePath);
        totalProjectSize += isBinary ? content.length : Buffer.byteLength(content, 'utf8');
      } catch (error) {
        logger.warning(`⚠️ Could not calculate size for ${filePath}: ${error.message}`);
      }
    }

    const unchangedFiles = currentFiles.length - changedFiles.length;

    return {
      totalSize: uploadedSize, // Size of files we actually uploaded
      totalProjectSize: totalProjectSize, // Total size of entire project
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
