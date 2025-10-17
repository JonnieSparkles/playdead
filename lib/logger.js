// Centralized logging system with professional CLI output
// Provides consistent, colorful, and structured logging across the application

import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

class Logger {
  constructor() {
    this.spinner = null;
    this.isTTY = process.stdout.isTTY;
  }

  // ---------- Basic Logging Methods ----------

  info(message) {
    // Don't add emoji prefix if message already starts with an emoji
    const hasEmoji = /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(message);
    if (hasEmoji) {
      console.log(chalk.blue(message));
    } else {
      console.log(chalk.blue('ℹ️'), message);
    }
  }

  success(message) {
    // Don't add emoji prefix if message already starts with an emoji
    const hasEmoji = /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(message);
    if (hasEmoji) {
      console.log(chalk.green(message));
    } else {
      console.log(chalk.green('✅'), message);
    }
  }

  warning(message) {
    // Don't add emoji prefix if message already starts with an emoji
    const hasEmoji = /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(message);
    if (hasEmoji) {
      console.log(chalk.yellow(message));
    } else {
      console.log(chalk.yellow('⚠️'), message);
    }
  }

  error(message) {
    // Don't add emoji prefix if message already starts with an emoji
    const hasEmoji = /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(message);
    if (hasEmoji) {
      console.log(chalk.red(message));
    } else {
      console.log(chalk.red('❌'), message);
    }
  }

  // ---------- Spinner Methods ----------

  startSpinner(message) {
    if (this.isTTY) {
      this.spinner = ora(chalk.blue(message)).start();
    } else {
      console.log(chalk.blue('⏳'), message);
    }
  }

  updateSpinner(message) {
    if (this.spinner) {
      this.spinner.text = chalk.blue(message);
    } else if (!this.isTTY) {
      console.log(chalk.blue('⏳'), message);
    }
  }

  succeedSpinner(message) {
    if (this.spinner) {
      this.spinner.succeed(chalk.green(message));
      this.spinner = null;
    } else {
      console.log(chalk.green('✅'), message);
    }
  }

  failSpinner(message) {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    } else {
      console.log(chalk.red('❌'), message);
    }
  }

  clearSpinner() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
      // Add a newline to ensure clean separation from next output
      console.log('');
    }
  }

  // ---------- Structured Output Methods ----------

  showTable(data, options = {}) {
    const table = new Table({
      head: options.headers || ['Key', 'Value'],
      style: { head: ['cyan'] },
      ...options
    });

    if (Array.isArray(data)) {
      data.forEach(row => table.push(row));
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        table.push([key, value]);
      });
    }

    console.log(table.toString());
  }

  showBox(content, options = {}) {
    const defaultOptions = {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
      ...options
    };

    console.log(boxen(content, defaultOptions));
  }

  showDeploymentSummary(stats) {
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      style: { head: ['cyan'] }
    });

    table.push(
      ['Files Changed', stats.changedFiles || 0],
      ['Files Unchanged', stats.unchangedFiles || 0],
      ['Total Size', stats.totalSize || '0 B'],
      ['Manifest TX', stats.manifestTxId || 'N/A'],
      ['ArNS', stats.undername || 'N/A']
    );

    const content = chalk.green.bold('🎉 Dynamic deployment complete!') + '\n\n' + table.toString();
    
    this.showBox(content, {
      borderColor: 'green',
      title: 'Deployment Summary',
      titleAlignment: 'center'
    });
  }

  // ---------- Progress Tracking ----------

  showProgress(current, total, item) {
    // Don't show progress if a spinner is active to prevent conflicts
    if (this.spinnerActive) {
      return;
    }
    
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    
    if (this.isTTY) {
      process.stdout.write(`\r${chalk.blue('📤')} [${progressBar}] ${percentage}% - ${item}`);
      if (current === total) {
        process.stdout.write('\n');
      }
    } else {
      console.log(chalk.blue('📤'), `[${current}/${total}] ${item}`);
    }
  }

  // ---------- Specialized Methods ----------

  showFileUpload(filePath, index, total) {
    const relativePath = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
    this.showProgress(index + 1, total, `Uploading ${relativePath}...`);
  }

  showStaticProgress(message) {
    // Show progress without animation - just a simple message
    this.info(`⏳ ${message}`);
  }

  showWalletLoading(source) {
    // Clear any existing spinner first to avoid line conflicts
    this.clearSpinner();
    this.info(`🔑 Loading wallet from ${source}`);
  }

  showBalance(balance) {
    // Helper function to convert winc to credits (1 Credit = 1,000,000,000,000 WINC)
    const wincToCredits = (wincAmount) => {
      const winc = parseInt(wincAmount || 0);
      const credits = winc / 1000000000000; // 1 trillion winc = 1 credit
      return credits.toFixed(6);
    };
    
    // Handle both string and object balance formats
    let walletBalance;
    if (typeof balance === 'object' && balance !== null) {
      // Extract the wallet balance value from the object
      walletBalance = balance.balance || balance.winc || balance.amount || balance.total || '0';
      
      // Check for shared credits info
      if (balance.receivedApprovals && balance.receivedApprovals.length > 0) {
        // Calculate available shared credits (approved - used)
        const availableSharedCredits = balance.receivedApprovals.reduce((sum, approval) => {
          const approved = parseInt(approval.approvedWincAmount || 0);
          const used = parseInt(approval.usedWincAmount || 0);
          return sum + (approved - used);
        }, 0);
        
        this.info(`💰 Wallet: ${wincToCredits(walletBalance)} credits | Shared credits: ${wincToCredits(availableSharedCredits)} credits`);
      } else {
        this.info(`💰 Wallet: ${wincToCredits(walletBalance)} credits | No shared credits available`);
      }
    } else {
      walletBalance = balance || '0';
      this.info(`💰 Wallet: ${wincToCredits(walletBalance)} credits`);
    }
    
    // Add a newline after balance display for clean separation
    console.log('');
  }

  showArNSOperation(operation, undername, txId) {
    this.info(`🔗 ${operation}: ${undername} → ${txId}`);
  }

  showManifestUpdate(count) {
    this.info(`📋 Updated manifest with ${count} new file IDs`);
  }

  showCommitInfo(commitHash, message) {
    this.info(`📝 Current commit: ${commitHash} - ${message}`);
  }

  showChangedFiles(count) {
    this.info(`📁 Changed files: ${count}`);
  }

  showNoChanges() {
    this.warning(' No changes detected - skipping deployment');
  }

  // ---------- Error Handling ----------

  showError(context, error) {
    this.error(`${context}: ${error.message || error}`);
  }

  showRetry(attempt, maxRetries, delay) {
    this.warning(`🔄 Upload attempt ${attempt} failed, retrying in ${delay} seconds...`);
  }

  showTimeout(operation) {
    this.warning(`⏰ ${operation} timeout occurred, checking if operation actually succeeded...`);
  }

  // ---------- Discord/Notification Methods ----------

  showDiscordNotification(status) {
    const emoji = status === 'success' ? '✅' : '❌';
    const color = status === 'success' ? 'green' : 'red';
    console.log(chalk[color](`${emoji} Discord notification sent`));
  }

  showDiscordError(error) {
    this.error(`Discord notification failed: ${error.message}`);
  }

  // ---------- Utility Methods ----------

  clearLine() {
    if (this.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
  }

  newLine() {
    console.log();
  }

  separator() {
    console.log(chalk.gray('─'.repeat(50)));
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;
