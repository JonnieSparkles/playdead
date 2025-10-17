#!/usr/bin/env node

// App-Factory (Dynamic Agentic Deployment System)
// Main script for deploying files to Arweave with ArNS integration

import dotenv from 'dotenv';
import { 
  generateCommitHash, 
  generateShortHash, 
  readFile, 
  writeFile, 
  fileExists,
  guessContentType,
  loadConfig,
  logDeploymentResult,
  handleError,
  validateFileContent,
  validateFilePath,
  formatBytes,
  formatDuration
} from './lib/utils.js';
import { readJSONLogs, getLogStats } from './lib/logging.js';
import { uploadToArweave, getTurboClient, loadWallet } from './lib/arweave.js';
import { 
  checkUndernameAvailability, 
  createUndernameRecord, 
  getUndernameRecord 
} from './lib/arns.js';
import { sendDiscordNotification, testDiscordConnection, isDiscordConfigured } from './lib/discord.js';
import { ANT, ArweaveSigner } from '@ar.io/sdk';
import { DynamicDeployer } from './lib/dynamic-deploy.js';
import { logger } from './lib/logger.js';

// Load environment variables
dotenv.config();

// ---------- Dynamic Directory Deployment ----------
async function deployDirectoryDynamic(dirPath, options, startTime) {
  try {
    logger.info(`📁 Detected directory - using dynamic deployment`);
    
    // Extract app name from directory path
    const appName = dirPath.split('/').pop() || dirPath.split('\\').pop() || 'app';
    
    // Create dynamic deployer
    const deployer = new DynamicDeployer(appName, dirPath);
    
    // Validate directory before deployment
    const validation = await deployer.validateApp();
    if (!validation.valid) {
      throw new Error(`Directory validation failed: ${validation.error}`);
    }

    // Perform dynamic deployment
    const result = await deployer.deploy(options.testMode, options);
    
    if (result.success && !result.skipped) {
      // Log deployment result
      const logResult = {
        success: true,
        filePath: dirPath,
        commitHash: result.commitHash,
        txId: result.manifestTxId,
        manifestTxId: result.manifestTxId,
        undername: result.undername,
        fileSize: result.stats.totalSize,
        duration: Date.now() - startTime,
        testMode: options.testMode,
        deploymentType: 'dynamic',
        changedFiles: result.changedFiles.length,
        version: result.version
      };
      
      await logDeploymentResult(logResult, result.stats);
      
      logger.success(`Dynamic deployment completed for directory: ${dirPath}`);
      logger.info(`   📁 Files changed: ${result.changedFiles.length}`);
      logger.info(`   📦 Size: ${formatBytes(result.stats.totalSize)}`);
      logger.info(`   🔗 Manifest TX: ${result.manifestTxId}`);
      logger.info(`   🔗 ArNS: ${result.undername}`);
      
      // Show deployment summary table last
      logger.newLine();
      logger.showDeploymentSummary({
        changedFiles: result.stats.fileCount || result.changedFiles.length,
        unchangedFiles: result.stats.unchangedFiles || 0,
        totalSize: result.stats.totalSize || 0,
        totalProjectSize: result.stats.totalProjectSize || 0,
        manifestTxId: result.manifestTxId || 'N/A',
        undername: result.undername || 'N/A'
      });
      
      return logResult;
    } else if (result.skipped) {
      return {
        success: true,
        skipped: true,
        reason: result.reason,
        filePath: dirPath,
        commitHash: result.commitHash
      };
    } else {
      throw new Error(`Dynamic deployment failed: ${result.error}`);
    }
  } catch (error) {
    const result = handleError(error, `Dynamic directory deployment for '${dirPath}': `);
    result.duration = Date.now() - startTime;
    result.filePath = dirPath;
    result.deploymentType = 'dynamic';
    
    await logDeploymentResult(result);
    return result;
  }
}

// ---------- Full Directory Deployment (No Dynamic Optimization) ----------
async function deployDirectoryFull(dirPath, options, startTime) {
  try {
    logger.info(`📁 Detected directory - using full deployment (no dynamic optimization)`);
    
    // Extract app name from directory path
    const appName = dirPath.split('/').pop() || dirPath.split('\\').pop() || 'app';
    
    // Create dynamic deployer
    const deployer = new DynamicDeployer(appName, dirPath);
    
    // Validate directory before deployment
    const validation = await deployer.validateApp();
    if (!validation.valid) {
      throw new Error(`Directory validation failed: ${validation.error}`);
    }

    // Force full deployment by temporarily removing tracking files
    const fs = await import('fs');
    const path = await import('path');
    const trackerPath = path.join(dirPath, 'deployment-tracker.json');
    const manifestPath = path.join(dirPath, 'manifest.json');
    
    let trackerBackup = null;
    let manifestBackup = null;
    
    try {
      // Backup existing files if they exist
      if (fs.existsSync(trackerPath)) {
        trackerBackup = fs.readFileSync(trackerPath, 'utf8');
        fs.unlinkSync(trackerPath);
      }
      if (fs.existsSync(manifestPath)) {
        manifestBackup = fs.readFileSync(manifestPath, 'utf8');
        fs.unlinkSync(manifestPath);
      }
      
      // Deploy with options (will treat as first deployment)
      const result = await deployer.deploy(options.testMode, options);
      
      if (result.success) {
        const logResult = {
          success: true,
          undername: result.undername,
          commitHash: result.commitHash,
          filePath: dirPath,
          txId: result.manifestTxId,
          manifestTxId: result.manifestTxId,
          fileSize: result.stats.totalSize,
          duration: Date.now() - startTime,
          rootArnsName: result.rootArnsName,
          deploymentType: 'full',
          version: result.version
        };
        
        await logDeploymentResult(logResult, result.stats);
        
        logger.success(`Full deployment completed for directory: ${dirPath}`);
        logger.info(`   📁 Files uploaded: ${result.stats.totalFiles}`);
        console.log(`   📦 Size: ${formatBytes(result.stats.totalSize)}`);
        console.log(`   🔗 Manifest TX: ${result.manifestTxId}`);
        console.log(`   🔗 ArNS: ${result.undername}`);
        
        return logResult;
      } else {
        throw new Error(`Full deployment failed: ${result.error}`);
      }
    } finally {
      // Restore backup files if they existed
      if (trackerBackup) {
        fs.writeFileSync(trackerPath, trackerBackup);
      }
      if (manifestBackup) {
        fs.writeFileSync(manifestPath, manifestBackup);
      }
    }
  } catch (error) {
    const result = handleError(error, `Full directory deployment for '${dirPath}': `);
    result.duration = Date.now() - startTime;
    result.filePath = dirPath;
    result.deploymentType = 'full';
    
    await logDeploymentResult(result);
    return result;
  }
}

// ---------- Main deployment function ----------
export async function deployFile(options = {}) {
  const startTime = Date.now();
  
  try {
    // Parse and validate options
    const {
      filePath = 'hello-world.txt',
      content = null,
      commitMessage = null,
      dryRun = false,
      testMode = false,
      announceDiscord = false,
      triggerAnnouncement = false,
      triggerGithubDeploy = false,
      useDynamic = true
    } = options;

    // Validate inputs
    validateFilePath(filePath);
    
    // Check if this is a directory (multi-file app) or single file
    const isDirectory = await fileExists(filePath) && (await import('fs')).statSync(filePath).isDirectory();
    
    if (isDirectory && useDynamic) {
      // Use dynamic deployment for directories
      return await deployDirectoryDynamic(filePath, options, startTime);
    } else if (isDirectory && !useDynamic) {
      // Use full directory deployment (no dynamic optimization)
      return await deployDirectoryFull(filePath, options, startTime);
    }
    
    // For single files, log the deployment start
    console.log(`🚀 Starting deployment for: ${filePath}`);
    
    // Read current file content or use provided content
    let fileContent;
    if (content !== null) {
      validateFileContent(content);
      fileContent = content;
      console.log(`📝 Using provided content (${formatBytes(content.length)})`);
    } else {
      if (!(await fileExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }
      fileContent = await readFile(filePath);
      console.log(`📖 Read existing file: ${filePath} (${formatBytes(fileContent.length)})`);
    }

    // Generate commit hash
    const commitHash = generateCommitHash(fileContent, commitMessage);
    const shortHash = generateShortHash(commitHash);
    console.log(`🔑 Generated commit hash: ${shortHash}...`);

    if (dryRun || testMode) {
      const mode = testMode ? 'test mode' : 'dry run';
      console.log(`🔍 ${mode} - would deploy to undername: ${shortHash}`);
      
      // In test mode, simulate a successful deployment
      if (testMode) {
        // Load minimal config for test mode
        const config = {
          arnsTtl: 60,
          appName: 'RemoteAgentDeploy'
        };
        const mockTxId = `test-${shortHash}-${Date.now()}`;
        const result = {
          success: true,
          testMode: true,
          filePath,
          commitHash: shortHash,
          txId: mockTxId,
          undername: shortHash,
          ttl: config.arnsTtl,
          fileSize: fileContent.length,
          duration: Date.now() - startTime,
          arnsRecordId: `test-record-${shortHash}`
        };
        
        await logDeploymentResult(result);
        
        
        
        // Send Discord notification if requested
        if (announceDiscord && result.success) {
          try {
            const discordResult = await sendDiscordNotification(result, true); // Force announce even in test mode
            if (discordResult.success) {
              console.log('📢 Discord notification sent');
            } else {
              console.log(`📢 Discord notification failed: ${discordResult.error || discordResult.reason}`);
            }
          } catch (error) {
            console.error('📢 Discord notification error:', error.message);
          }
        }
        
        // Trigger GitHub Actions announcement if requested
        if (triggerAnnouncement && result.success) {
          console.log('ℹ️  GitHub Actions announcement workflow should be triggered via GitHub Actions (see .github/workflows/announce.yml)');
        }

        // Handle trigger GitHub deployment option
        if (triggerGithubDeploy) {
          console.log('ℹ️  GitHub Actions deployment workflow should be triggered via GitHub Actions (see .github/workflows/deploy.yml)');
          return { success: true, message: 'GitHub Actions workflows are configured in .github/workflows/' };
        }
        
        return result;
      }
      
      return {
        success: true,
        dryRun: true,
        commitHash: shortHash,
        undername: shortHash,
        fileSize: fileContent.length,
        duration: Date.now() - startTime
      };
    }

    // Load configuration for real deployment
    const config = loadConfig();

    // Check if this commit already exists in ArNS
    const wallet = await loadWallet();
    const signer = new ArweaveSigner(wallet);
    const ant = ANT.init({ 
      signer: signer, 
      processId: config.antProcessId 
    });
    const existingRecord = await getUndernameRecord(ant, shortHash);
    
    if (existingRecord) {
      console.log(`⚠️ Commit already deployed: ${existingRecord.id}`);
      return {
        success: true,
        alreadyDeployed: true,
        commitHash: shortHash,
        txId: existingRecord.id,
        undername: shortHash,
        ttl: config.arnsTtl,
        fileSize: fileContent.length,
        duration: Date.now() - startTime
      };
    }

    // Upload to Arweave
    console.log(`☁️ Uploading to Arweave...`);
    const contentType = guessContentType(filePath);
    const txId = await uploadToArweave(
      Buffer.from(fileContent, 'utf-8'),
      contentType,
      config.appName
    );
    
    console.log(`✅ Uploaded to Arweave: ${txId}`);

    // Create ArNS record
    console.log(`📝 Creating ArNS record: ${shortHash} → ${txId}`);
    const arnsResult = await createUndernameRecord(
      ant,
      shortHash,
      txId,
      config.arnsTtl
    );

    if (!arnsResult.success) {
      throw new Error(`ArNS record creation failed: ${arnsResult.message}`);
    }

    // Update local file if content was provided
    if (content !== null) {
      await writeFile(filePath, content);
    }

    const result = {
      success: true,
      filePath,
      commitHash: shortHash,
      txId,
      undername: shortHash,
      ttl: config.arnsTtl,
      fileSize: fileContent.length,
      duration: Date.now() - startTime,
      arnsRecordId: arnsResult.recordId
    };

    await logDeploymentResult(result);
    
    
    
    // Send Discord notification if requested
    if (announceDiscord && result.success) {
      try {
        const discordResult = await sendDiscordNotification(result, true); // Force announce even in test mode
        if (discordResult.success) {
          console.log('📢 Discord notification sent');
        } else {
          console.log(`📢 Discord notification failed: ${discordResult.error || discordResult.reason}`);
        }
      } catch (error) {
        console.error('📢 Discord notification error:', error.message);
      }
    }
    
    // Trigger GitHub Actions announcement if requested
    if (triggerAnnouncement && result.success) {
      console.log('ℹ️  GitHub Actions announcement workflow should be triggered via GitHub Actions (see .github/workflows/announce.yml)');
    }
    
    return result;

  } catch (error) {
    const result = handleError(error, 'Deployment ');
    result.duration = Date.now() - startTime;
    result.filePath = options.filePath || 'hello-world.txt';
    
    // Log failed deployment
    await logDeploymentResult(result);
    return result;
  }
}

// ---------- Log viewing functions ----------
async function showLogs() {
  try {
    const logs = await readJSONLogs();
    
    if (logs.length === 0) {
      console.log('📋 No deployment logs found.');
      return;
    }
    
    console.log(`📋 Deployment Logs (${logs.length} entries):\n`);
    
    logs.forEach((log, index) => {
      const status = log.success ? '✅' : '❌';
      const timestamp = new Date(log.timestamp).toLocaleString();
      
      console.log(`${index + 1}. ${status} ${timestamp}`);
      console.log(`   File: ${log.filePath || 'N/A'}`);
      console.log(`   Commit: ${log.commitHash || 'N/A'}`);
      console.log(`   TX ID: ${log.txId || 'N/A'}`);
      console.log(`   Status: ${log.success ? 'SUCCESS' : 'FAILED'}`);
      if (log.error) {
        console.log(`   Error: ${log.error}`);
      }
      console.log('');
    });
  } catch (error) {
    console.error(`❌ Failed to show logs:`, error.message);
  }
}

async function showStats() {
  try {
    const stats = await getLogStats();
    
    if (!stats) {
      console.log('📊 No deployment statistics available.');
      return;
    }
    
    console.log('📊 Deployment Statistics:\n');
    console.log(`Total Deployments: ${stats.totalDeployments}`);
    console.log(`Successful: ${stats.successfulDeployments}`);
    console.log(`Failed: ${stats.failedDeployments}`);
    console.log(`Dry Runs: ${stats.dryRuns}`);
    console.log(`Already Deployed: ${stats.alreadyDeployed}`);
    console.log(`Total File Size: ${formatBytes(stats.totalFileSize)}`);
    console.log(`Average Duration: ${formatDuration(stats.averageDuration)}`);
    
    if (stats.lastDeployment) {
      console.log(`Last Deployment: ${new Date(stats.lastDeployment).toLocaleString()}`);
    }
    
    if (stats.totalDeployments > 0) {
      const successRate = ((stats.successfulDeployments / stats.totalDeployments) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}%`);
    }
  } catch (error) {
    console.error(`❌ Failed to show stats:`, error.message);
  }
}


async function testDiscord() {
  try {
    console.log('📢 Testing Discord webhook connection...');
    
    if (!isDiscordConfigured()) {
      console.log('❌ Discord not configured. Set DISCORD_WEBHOOK_URL');
      return;
    }
    
    const result = await testDiscordConnection();
    if (result.success) {
      console.log(`✅ Discord webhook test successful!`);
    } else {
      console.log(`❌ Discord webhook test failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Discord test failed:`, error.message);
  }
}


// ---------- CLI interface ----------
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {};

    // Parse options first
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--test-mode') {
        options.testMode = true;
      } else if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg === '--announce-discord') {
        options.announceDiscord = true;
      } else if (arg === '--trigger-announcement') {
        options.triggerAnnouncement = true;
      } else if (arg === '--trigger-github-deploy') {
        options.triggerGithubDeploy = true;
      } else if (arg === '--no-dynamic') {
        options.useDynamic = false;
      } else if (arg === '--customUndername') {
        options.customUndername = args[++i];
        if (!options.customUndername) {
          throw new Error('--customUndername requires a value');
        }
      } else if (arg === '--useRootName') {
        options.useRootName = true;
      }
    }

    // Parse commands
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--file':
        case '-f':
          options.filePath = args[++i];
          break;
        case '--content':
        case '-c':
          options.content = args[++i];
          break;
        case '--message':
        case '-m':
          options.commitMessage = args[++i];
          break;
        case '--dry-run':
          // Already parsed above
          break;
        case '--test-mode':
          // Already parsed above
          break;
        case '--logs':
        case '-l':
          await showLogs();
          process.exit(0);
          break;
        case '--stats':
        case '-s':
          await showStats();
          process.exit(0);
          break;
        case '--test-discord':
          await testDiscord();
          process.exit(0);
          break;
        case '--announce-discord':
          // Already parsed above
          break;
        case '--trigger-announcement':
          // Already parsed above
          break;
        case '--trigger-github-deploy':
          // Already parsed above
          break;
          case '--help':
        case '-h':
          console.log(`
Usage: node deploy.js [options]

Deployment Options:
  -f, --file <path>         Deploy a specific file or directory
  -c, --content <text>      Deploy content directly
  -m, --message <text>      Commit message for hash generation
  --customUndername <name>  Use custom ArNS undername instead of commit hash
  --useRootName             Set root record (@) instead of undername record
  --test-mode               Simulate deployment with mock data (no real upload)
  --no-dynamic              Disable dynamic deployment (full deployment)

Utility Options:
  -l, --logs              Show deployment logs
  -s, --stats             Show deployment statistics
  --test-discord          Test Discord webhook connection
  -h, --help              Show this help message

Examples:
  # Deploy a file
  node deploy.js --file path/to/your/file.html
  node deploy.js --file my-app.html
  
  # Deploy a directory (uses dynamic deployment)
  node deploy.js --file path/to/your/app/
  node deploy.js --file apps/your-project/
  
  # Deploy content directly
  node deploy.js --content "Hello, World!"
  
  # Test deployment
  node deploy.js --test-mode --file path/to/your/file.html
  node deploy.js --test-mode --file path/to/your/app/
  
  # Full deployment (no dynamic)
  node deploy.js --no-dynamic --file path/to/your/app/
  
  # View logs and stats
  node deploy.js --logs
  node deploy.js --stats
  node deploy.js --test-discord
          `);
          process.exit(0);
          break;
        default:
          if (arg.startsWith('-')) {
            // Skip flags that were already processed in the options loop
            if (arg === '--customUndername' || arg === '--useRootName' || 
                arg === '--test-mode' || arg === '--dry-run' || 
                arg === '--announce-discord' || arg === '--trigger-announcement' || 
                arg === '--trigger-github-deploy' || arg === '--no-dynamic') {
              // Skip this flag as it was already processed
              break;
            }
            // Unknown flag - show error and exit
            console.error(`❌ Unknown option: ${arg}`);
            console.error(`💡 Use --help to see available options`);
            process.exit(1);
          } else {
            // Treat as content if no flag
            options.content = arg;
          }
          break;
      }
    }

    // Check if filePath is a parent directory with multiple apps
    // Only do this if the path ends with a common parent directory name
    const isCommonParentDir = options.filePath && (
      options.filePath.endsWith('apps/') || 
      options.filePath.endsWith('apps') ||
      options.filePath === 'apps'
    );
    
    if (isCommonParentDir && await isParentDirectory(options.filePath)) {
      console.log(`📁 Detected parent directory: ${options.filePath}`);
      console.log(`🚀 Deploying all apps in directory...`);
      
      const subdirs = await getSubdirectories(options.filePath);
      if (subdirs.length === 0) {
        console.log(`⚠️ No subdirectories found in ${options.filePath}`);
        process.exit(1);
      }
      
      console.log(`📋 Found ${subdirs.length} app(s) to deploy:`);
      subdirs.forEach(dir => console.log(`   - ${path.basename(dir)}`));
      console.log('');
      
      let successCount = 0;
      let totalCount = subdirs.length;
      
      for (const subdir of subdirs) {
        const appName = path.basename(subdir);
        console.log(`📁 Deploying app: ${appName}`);
        console.log('----------------------------------------');
        
        const appOptions = { ...options, filePath: subdir };
        const result = await deployFile(appOptions);
        
        if (result.success) {
          if (result.skipped) {
            console.log(`⏭️ App ${appName} had no changes - skipped`);
          } else {
            console.log(`✅ App ${appName} deployed successfully`);
            successCount++;
          }
        } else {
          console.error(`❌ App ${appName} failed: ${result.error}`);
        }
        console.log('');
      }
      
      console.log(`📊 Deployment Summary:`);
      console.log(`   📁 Total apps: ${totalCount}`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ⏭️ Skipped: ${totalCount - successCount}`);
      
      if (successCount > 0) {
        console.log(`✅ Deployments completed successfully!`);
      } else {
        console.log(`✅ All apps checked - no changes detected`);
      }
      
    } else {
      // Deploy single file/directory
      const result = await deployFile(options);
      
      if (!result.success) {
        console.error(`❌ Deployment failed: ${result.error}`);
        process.exit(1);
      }

      if (result.dryRun) {
        console.log(`🔍 Dry run completed successfully`);
      } else if (result.skipped) {
        console.log(`✅ No changes detected - deployment not needed`);
      } else if (result.alreadyDeployed) {
        console.log(`✅ File already deployed with this content`);
      } else {
        console.log(`✅ Deployment completed successfully`);
      }
    }

  } catch (error) {
    console.error(`❌ Fatal error:`, error.message);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to check if a path is a parent directory with multiple subdirectories
async function isParentDirectory(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      return false;
    }
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const subdirs = entries.filter(entry => entry.isDirectory());
    
    // Consider it a parent directory if it has 2+ subdirectories
    return subdirs.length >= 2;
  } catch (error) {
    return false;
  }
}

// Helper function to get all subdirectories
async function getSubdirectories(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const subdirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(dirPath, entry.name));
    
    return subdirs;
  } catch (error) {
    return [];
  }
}

if (process.argv[1] === __filename) {
  main();
}
