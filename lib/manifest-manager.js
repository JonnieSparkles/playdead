// Per-app manifest management for dynamic Arweave deployment
// Handles loading, updating, and saving app-specific manifests

import { readFile, writeFile, fileExists, getAllFilesInDirectory, isDirectory, normalizePath } from './utils.js';
import { logger } from './logger.js';
import path from 'path';
import fs from 'fs/promises';

export class ManifestManager {
  constructor(appId, appPath) {
    this.appId = appId;
    this.appPath = appPath;
    this.manifestPath = path.join(appPath, 'manifest.json');
    this.trackerPath = path.join(appPath, 'deployment-tracker.json');
  }

  // ---------- Manifest Operations ----------

  async loadManifest() {
    try {
      if (await fileExists(this.manifestPath)) {
        const manifestData = await readFile(this.manifestPath);
        return JSON.parse(manifestData);
      }
      const emptyManifest = await this.createEmptyManifest();
      // Save the empty manifest to disk so it persists
      await this.saveManifest(emptyManifest);
      return emptyManifest;
    } catch (error) {
      throw new Error(`Failed to load manifest for ${this.appId}: ${error.message}`);
    }
  }

  async saveManifest(manifest) {
    try {
      await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
    } catch (error) {
      throw new Error(`Failed to save manifest for ${this.appId}: ${error.message}`);
    }
  }

  async createEmptyManifest() {
    const entryPoint = await this.getEntryPoint();
    return {
      manifest: "arweave/paths",
      version: "0.2.0",
      index: { path: entryPoint },
      paths: {}
    };
  }

  // ---------- Deployment Tracker Operations ----------

  async loadDeploymentTracker() {
    try {
      if (await fileExists(this.trackerPath)) {
        const trackerData = await readFile(this.trackerPath);
        return JSON.parse(trackerData);
      }
      const emptyTracker = this.createEmptyTracker();
      // Save the empty tracker to disk so it persists
      await this.saveDeploymentTracker(emptyTracker);
      return emptyTracker;
    } catch (error) {
      throw new Error(`Failed to load deployment tracker for ${this.appId}: ${error.message}`);
    }
  }

  async saveDeploymentTracker(tracker) {
    try {
      await writeFile(this.trackerPath, JSON.stringify(tracker, null, 2));
    } catch (error) {
      throw new Error(`Failed to save deployment tracker for ${this.appId}: ${error.message}`);
    }
  }

  async loadManualOverrides() {
    const overridesPath = path.join(this.appPath, 'manifest-overrides.json');
    try {
      if (await fileExists(overridesPath)) {
        const overridesData = await readFile(overridesPath);
        const overrides = JSON.parse(overridesData);
        logger.info(`📋 Loaded ${Object.keys(overrides).length} manual TXID override(s)`);
        return overrides;
      }
    } catch (error) {
      logger.warning(`Could not load manifest-overrides.json: ${error.message}`);
    }
    return {};
  }

  createEmptyTracker() {
    return {
      trackerVersion: '1.0.0',
      lastDeployCommit: null,
      lastDeployed: null,
      deploymentCount: 0,
      fileHashes: {},
      recentDeployments: []
    };
  }

  // ---------- Manifest Building ----------

  async buildManifestFromFiles(fileIds, entryPoint = null) {
    // Use provided entryPoint or detect it automatically
    const actualEntryPoint = entryPoint || await this.getEntryPoint();
    
    const manifest = {
      manifest: "arweave/paths",
      version: "0.2.0", // Fixed Arweave manifest specification version
      index: { path: actualEntryPoint },
      paths: {}
    };

    // Add all files to paths
    for (const [filePath, txId] of Object.entries(fileIds)) {
      const relativePath = normalizePath(path.relative(this.appPath, filePath));
      manifest.paths[relativePath] = { id: txId };
    }

    return manifest;
  }

  async getCurrentVersion() {
    try {
      const manifest = await this.loadManifest();
      return manifest.version || "0.1.0";
    } catch {
      return "0.1.0";
    }
  }

  incrementVersion(currentVersion) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  // ---------- File Discovery ----------

  async discoverAppFiles() {
    const files = [];
    
    if (!(await isDirectory(this.appPath))) {
      throw new Error(`App path does not exist: ${this.appPath}`);
    }

    const allFiles = await getAllFilesInDirectory(this.appPath);
    
    for (const file of allFiles) {
      // Skip manifest, tracker, and override files
      if (file.name === 'manifest.json' || file.name === 'deployment-tracker.json' || file.name === 'manifest-overrides.json') {
        continue;
      }
      
      // Check if file is deployable (exclude directories and handle permission errors)
      if (await this.isDeployableFile(file.absolutePath)) {
        files.push(file.absolutePath);
      }
    }

    return files;
  }

  async isDeployableFile(filePath) {
    try {
      const stat = await fs.stat(filePath);
      return !stat.isDirectory();
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.warn(`⚠️ Permission denied accessing ${filePath} - skipping`);
        return false; // Skip files we can't access
      }
      // For other errors (file not found, etc.), also skip
      return false;
    }
  }

  // ---------- Change Detection Helpers ----------

  async getLastDeployCommit() {
    const tracker = await this.loadDeploymentTracker();
    return tracker.lastDeployCommit;
  }

  async getChangedFilesByHash(gitTracker) {
    console.log(`🔍 Using hash-based change detection...`);
    
    // Get all current app files
    const allFiles = await this.discoverAppFiles();
    
    // Filter to only git-tracked files (safety check for local runs)
    const trackedFiles = [];
    for (const file of allFiles) {
      if (await gitTracker.isFileTracked(file)) {
        trackedFiles.push(file);
      }
    }
    
    const changedFiles = [];
    
    // Load stored file hashes from deployment tracker
    const tracker = await this.loadDeploymentTracker();
    const storedHashes = tracker.fileHashes || {};
    
    // Check each file for changes
    for (const filePath of trackedFiles) {
      const relativePath = normalizePath(path.relative(this.appPath, filePath));
      
      // Get current file hash
      const currentHash = await gitTracker.getFileHash(filePath);
      const storedHash = storedHashes[relativePath];
      
      // Handle both old complex hash format and new simple string format
      let storedHashString = storedHash;
      if (storedHash && typeof storedHash === 'object' && storedHash.oid) {
        // Old format: complex object with oid property
        storedHashString = storedHash.oid;
      }
      
      if (!storedHash || currentHash !== storedHashString) {
        changedFiles.push(filePath);
        console.log(`📝 File changed: ${relativePath} (${storedHash ? 'modified' : 'new'})`);
      }
    }
    
    // Check for deleted files (files in stored hashes but not in current tracked files)
    const currentRelativePaths = trackedFiles.map(f => normalizePath(path.relative(this.appPath, f)));
    const deletedFiles = [];
    for (const relativePath of Object.keys(storedHashes)) {
      if (!currentRelativePaths.includes(relativePath)) {
        deletedFiles.push(relativePath);
      }
    }
    
    // Only log deletions if we're actually going to deploy
    if (changedFiles.length > 0 && deletedFiles.length > 0) {
      for (const deletedFile of deletedFiles) {
        console.log(`🗑️ File deleted: ${deletedFile}`);
      }
    } else if (deletedFiles.length > 0) {
      // Log with context when no deployment needed
      for (const deletedFile of deletedFiles) {
        console.log(`🗑️ File deleted: ${deletedFile} (no deployment needed)`);
      }
    }
    
    return { changedFiles, currentFiles: trackedFiles };
  }

  async updateDeploymentTracker(commitHash, manifestTxId, changedFiles, fileHashes = {}, currentFiles = []) {
    const tracker = await this.loadDeploymentTracker();
    
    // Ensure tracker has the new structure
    if (!tracker.trackerVersion) {
      tracker.trackerVersion = '1.0.0';
    }
    if (!tracker.fileHashes) {
      tracker.fileHashes = {};
    }
    if (!tracker.recentDeployments) {
      tracker.recentDeployments = [];
    }
    
    // Update tracking data
    tracker.lastDeployCommit = commitHash;
    tracker.lastDeployed = new Date().toISOString();
    tracker.deploymentCount = (tracker.deploymentCount || 0) + 1;
    
    // Add to recent deployments (limit to 3 most recent)
    const relativeChangedFiles = changedFiles.map(file => normalizePath(path.relative(this.appPath, file)));
    tracker.recentDeployments.unshift({
      commit: commitHash,
      manifestTxId: manifestTxId,
      changedFiles: relativeChangedFiles,
      deployed: tracker.lastDeployed
    });
    
    // Keep only last 3 deployments in recent history
    if (tracker.recentDeployments.length > 3) {
      tracker.recentDeployments = tracker.recentDeployments.slice(0, 3);
    }
    
    // Update file hashes (for hash-based change detection)
    // Always update hashes, even if fileHashes is empty
    tracker.fileHashes = { ...tracker.fileHashes, ...fileHashes };
    
    // Migrate any remaining old complex hash format to simple string format
    for (const [filePath, hash] of Object.entries(tracker.fileHashes)) {
      if (hash && typeof hash === 'object' && hash.oid) {
        // Convert old complex format to simple string format
        tracker.fileHashes[filePath] = hash.oid;
      }
    }
    
    // Clean up hashes for files that no longer exist
    if (currentFiles.length > 0) {
      const currentRelativePaths = new Set(
        currentFiles.map(file => normalizePath(path.relative(this.appPath, file)))
      );
      
      const cleanedHashes = {};
      for (const [filePath, hash] of Object.entries(tracker.fileHashes)) {
        if (currentRelativePaths.has(filePath)) {
          cleanedHashes[filePath] = hash;
        }
      }
      tracker.fileHashes = cleanedHashes;
    }
    
    await this.saveDeploymentTracker(tracker);
    return tracker;
  }

  // ---------- Utility Methods ----------

  async getEntryPoint() {
    const possibleEntryPoints = [
      'index.html',
      'main.html', 
      'app.html',
      'index.js',
      'main.js',
      'app.js',
      'index.txt'
    ];
    
    for (const entry of possibleEntryPoints) {
      const entryPath = path.join(this.appPath, entry);
      if (await fileExists(entryPath)) {
        return entry;
      }
    }
    
    // Fallback to first file
    const files = await this.discoverAppFiles();
    if (files.length > 0) {
      return normalizePath(path.relative(this.appPath, files[0]));
    }
    
    throw new Error(`No entry point found for app ${this.appId}`);
  }

  async getAppInfo() {
    const manifest = await this.loadManifest();
    const tracker = await this.loadDeploymentTracker();
    
    return {
      appId: this.appId,
      version: manifest.version,
      entryPoint: manifest.index?.path,
      fileCount: Object.keys(manifest.paths).length,
      lastDeployed: tracker.lastDeployed,
      deploymentCount: tracker.deploymentCount,
      lastDeployCommit: tracker.lastDeployCommit
    };
  }
}
