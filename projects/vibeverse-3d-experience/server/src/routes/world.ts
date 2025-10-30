import { Router, Request, Response } from 'express';
import { WorldConfig } from '../types/world';
import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

export const worldRouter = Router();

// Fetch world configuration (session token and network URL) from remote source
async function fetchWorldConfig(worldId: string): Promise<{ sessionToken: string; networkUrl: string }> {
  const remoteUrl = `https://nathantest-6e8649_${worldId}.msquared.world/`;

  const html = await internal.fetchRemote(remoteUrl);
  
  // Extract first <script> tag content
  const scriptContent = internal.extractFirstScript(html);
  if (scriptContent == null) {
    throw new Error('No <script> tag found in remote content');
  }

  const jsonSegment = internal.extractJsonBetweenBraces(scriptContent);
  if (jsonSegment == null) {
    throw new Error('No JSON object braces found in script content');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonSegment);
  } catch (e) {
    throw new Error('Failed to parse JSON extracted from script content');
  }

  const { sessionToken, networkUrl } = parsed;
  return { sessionToken, networkUrl };
}

// Load and hydrate HTML template with world configuration
async function loadAndHydrateHtml(sessionToken: string, networkUrl: string): Promise<string> {
  const htmlTemplatePath = path.join(__dirname, '../../public/world.html');
  let htmlTemplate = await fs.readFile(htmlTemplatePath, 'utf-8');
  
  // Replace placeholders with actual values
  htmlTemplate = htmlTemplate
    .replace('PLACHOLDER_SESSION_TOKEN', sessionToken)
    .replace('PLACHOLDER_NETWORK_URL', networkUrl);
  
  return htmlTemplate;
}

// GET /world/:id/web -> returns the id provided
worldRouter.get('/:id/web', async (req: Request, res: Response) => {
  try {
    const { sessionToken, networkUrl } = await fetchWorldConfig(req.params.id);
    const htmlContent = await loadAndHydrateHtml(sessionToken, networkUrl);
    
    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlContent);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to retrieve connection details' });
  }
});


// POST /world/:id/config -> echoes back the id and posted JSON body
worldRouter.post('/:id/config', (req: Request, res: Response) => {
  const { id } = req.params;
  const body: WorldConfig = req.body;
  res.json({ id, config: body });
});

// Helper: fetch remote URL (without adding a dependency) using http/https
export function fetchRemote(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, (resp) => {
        if (resp.statusCode && resp.statusCode >= 400) {
          reject(new Error('Bad status code: ' + resp.statusCode));
          resp.resume();
          return;
        }
        resp.setEncoding('utf8');
        let data = '';
        resp.on('data', (chunk) => (data += chunk));
        resp.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

// Namespace object to facilitate test mocking (jest.spyOn(worldModule.internal, 'fetchRemote'))
export const internal = {
  fetchRemote,
  extractFirstScript,
  extractJsonBetweenBraces,
  fetchWorldConfig,
  loadAndHydrateHtml
};

// Helper: extract the contents of the first <script>...</script> tag
export function extractFirstScript(html: string): string | null {
  const scriptOpenIdx = html.indexOf('<script');
  if (scriptOpenIdx === -1) return null;
  const startTagEnd = html.indexOf('>', scriptOpenIdx);
  if (startTagEnd === -1) return null;
  const closeIdx = html.indexOf('</script>', startTagEnd + 1);
  if (closeIdx === -1) return null;
  return html.substring(startTagEnd + 1, closeIdx).trim();
}

// Helper: from a string, take substring from first '{' to last '}' (inclusive)
export function extractJsonBetweenBraces(content: string): string | null {
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  return content.substring(first, last + 1);
}
