// Template management system for deployment announcements

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

const TEMPLATES_DIR = './reply-templates';

// ---------- Load template from file ----------
export async function loadTemplate(templateName) {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.json`);
    const templateData = await fs.readFile(templatePath, 'utf-8');
    return JSON.parse(templateData);
  } catch (error) {
    throw new Error(`Template '${templateName}' not found: ${error.message}`);
  }
}

// ---------- List available templates ----------
export async function listTemplates() {
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const templates = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const templateName = file.replace('.json', '');
        const template = await loadTemplate(templateName);
        templates.push({
          name: templateName,
          description: template.description,
          example: template.example
        });
      }
    }
    
    return templates;
  } catch (error) {
    logger.showError('Failed to list templates', error);
    return [];
  }
}

// ---------- Render template with variables ----------
export function renderTemplate(template, variables) {
  let rendered = template.template;
  
  // Replace variables in the template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    rendered = rendered.replace(new RegExp(placeholder, 'g'), value || '');
  }
  
  return rendered;
}

// ---------- Get template for deployment type ----------
export async function getTemplateForDeployment(deploymentData) {
  if (deploymentData.isNoChanges) {
    return await loadTemplate('no-changes');
  } else if (deploymentData.success) {
    return await loadTemplate('success');
  } else {
    // For now, we only have success and no-changes templates
    // Could add failure template later
    throw new Error('No template available for failed deployments');
  }
}

// ---------- Validate template ----------
export function validateTemplate(template) {
  const required = ['name', 'description', 'template'];
  
  for (const field of required) {
    if (!template[field]) {
      throw new Error(`Template missing required field: ${field}`);
    }
  }
  
  return true;
}
