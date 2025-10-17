// Discord webhook notification system for deployment updates

import { loadConfig } from './utils.js';
import { getTemplateForDeployment, renderTemplate } from './templates.js';
import { logger } from './logger.js';

// ---------- Discord webhook client ----------
function getDiscordWebhookUrl() {
  const config = loadConfig();
  
  if (!config.discordWebhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  return config.discordWebhookUrl;
}

// ---------- Format deployment message for Discord ----------
async function formatDeploymentMessage(deploymentData) {
  
  try {
    const template = await getTemplateForDeployment(deploymentData);
    
    // Try to load config, but don't fail if environment variables are missing
    let config = null;
    try {
      config = loadConfig();
    } catch (error) {
      logger.warning('Config not available, using deployment data directly');
    }
    
    const duration = deploymentData.duration ? `${(deploymentData.duration / 1000).toFixed(1)}s` : null;
    const durationLine = duration ? `⏱️ Duration\n${duration}\n` : '';
    
    const variables = {
      undername: deploymentData.undername || deploymentData.commitHash || 'unknown',
      rootArnsName: config?.rootArnsName || deploymentData.rootArnsName || 'unknown',
      filePath: deploymentData.filePath || 'unknown',
      duration: duration || 'N/A',
      durationLine: durationLine,
      manifestTxId: deploymentData.manifestTxId || deploymentData.txId || 'unknown',
      totalApps: deploymentData.totalApps || '5'
    };
    
    const message = renderTemplate(template, variables);
    
    // Create clickable link from the message
    const linkMatch = message.match(/https:\/\/[^\s]+/);
    // Check if undername already includes the root name (new format) or needs to be combined (old format)
    const undername = variables.undername;
    const rootArnsName = variables.rootArnsName;
    const deploymentUrl = linkMatch ? linkMatch[0] : 
      (undername.includes('_') ? 
        `https://${undername}.arweave.net` : 
        `https://${undername}_${rootArnsName}.arweave.net`);
    
    // Create an embed with the template content for the green line effect
    const embed = {
      title: "🚀 Deployment Complete!",
      description: message,
      color: 0x00ff00, // Green color for the line
      timestamp: new Date().toISOString(),
      footer: {
        text: "Arweave Deployment System"
      }
    };

    return {
      content: `@everyone`,
      deploymentUrl: deploymentUrl,
      embed: embed
    };
  } catch (error) {
    logger.warning('Template formatting failed, using default message:', error.message);
    
    const status = deploymentData.success ? '✅' : '❌';
    const action = deploymentData.success ? 'completed' : 'failed';
    const file = deploymentData.filePath || 'unknown file';
    const undername = deploymentData.undername || deploymentData.commitHash || 'unknown';
    const config = loadConfig();
    const rootArnsName = config.rootArnsName || 'unknown';
    
    const deploymentUrl = `https://${undername}_${rootArnsName}.arweave.net`;
    
    return {
      content: `@everyone\n\n${status} Deployment ${action}!`,
      deploymentUrl: deploymentUrl,
      embed: {
        title: `${status} Deployment ${action}!`,
        description: `Deployment ${action} for ${file}`,
        color: deploymentData.success ? 0x00ff00 : 0xff0000, // Green for success, red for failure
        fields: [
          {
            name: "📁 File",
            value: file,
            inline: true
          },
          {
            name: "🔑 Hash",
            value: `\`${undername}\``,
            inline: true
          },
          {
            name: "🔗 Deployment URL",
            value: `[View Deployment](${deploymentUrl})`,
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "Arweave Deployment System"
        }
      }
    };
  }
}

// ---------- Send Discord notification ----------
export async function sendDiscordNotification(deploymentData, forceAnnounce = false) {
  try {
    // Check if Discord is configured
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.info('📢 Discord notifications not configured (DISCORD_WEBHOOK_URL not set)');
      return { success: false, reason: 'not_configured' };
    }

    // Skip test mode unless forceAnnounce is true
    if (deploymentData.testMode && !forceAnnounce) {
      logger.info('📢 Skipping Discord notification for test mode');
      return { success: false, reason: 'test_mode' };
    }

    const { content, deploymentUrl, embed } = await formatDeploymentMessage(deploymentData);
    
    // Always use embed format for the green line effect
    let payload;
    
    if (embed) {
      // Use the embed (either template-based or fallback)
      payload = {
        content: content,
        embeds: [embed]
      };
    } else {
      // Fallback to plain text if no embed
      payload = {
        content: content
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} ${error}`);
    }

    logger.showDiscordNotification('success');
    return { success: true, deploymentUrl: deploymentUrl };
    
  } catch (error) {
    logger.showDiscordError(error);
    return { success: false, error: error.message };
  }
}

// ---------- Test Discord connection ----------
export async function testDiscordConnection() {
  try {
    const webhookUrl = getDiscordWebhookUrl();
    
    const payload = {
      content: "🧪 Testing Discord webhook connection...",
      embeds: [{
        title: "🔧 Connection Test",
        description: "If you see this message, Discord webhook is working!",
        color: 0x0099ff, // Blue color for test
        fields: [
          {
            name: "✅ Status",
            value: "Webhook connection successful",
            inline: true
          },
          {
            name: "🕐 Test Time",
            value: new Date().toLocaleString(),
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "Arweave Deployment System - Test"
        }
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} ${error}`);
    }

    logger.success('📢 Discord webhook test successful!');
    return { success: true };
  } catch (error) {
    logger.showDiscordError(error);
    return { success: false, error: error.message };
  }
}

// ---------- Utility functions ----------
export function isDiscordConfigured() {
  try {
    const config = loadConfig();
    return !!config.discordWebhookUrl;
  } catch {
    return false;
  }
}
