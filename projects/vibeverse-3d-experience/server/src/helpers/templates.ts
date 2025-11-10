import fs from 'fs';
import path from 'path';
import mustache from 'mustache';

const templatesDir = path.join(__dirname, '../templates');

// Cache for template contents
const templateCache = new Map<string, string>();

/**
 * Load a template file from the templates directory
 */
function loadTemplate(templateName: string): string {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }
  
  const templatePath = path.join(templatesDir, `${templateName}.mustache`);
  
  try {
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    templateCache.set(templateName, templateContent);
    return templateContent;
  } catch (error) {
    throw new Error(`Template '${templateName}' not found at ${templatePath}`);
  }
}

/**
 * Render a template with data
 */
export function renderTemplate(templateName: string, data: any = {}): string {
  const template = loadTemplate(templateName);
  return mustache.render(template, data);
}

/**
 * Clear template cache (useful for development)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}