import { Router, Request, Response } from 'express';
import { WorldConfig } from '../types/world';
import { fetchRemoteWithAuth, postRemoteWithAuth } from '../helpers/api';
import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path, { parse } from 'path';

export const worldRouter = Router();

const MSQUARED_WEBWORLDS_PROJECT = process.env.MSQUARED_WEBWORLDS_PROJECT || 'vibeverse-custom-df556d';
const MSQUARED_WEBWORLDS_API_BASE = process.env.MSQUARED_WEBWORLDS_API_BASE || 'https://api.msquared.io/v1/worlds/';
const MSQUARED_WEBWORLDS_API_KEY = process.env.MSQUARED_WEBWORLDS_API_KEY || '';



// Fetch world configuration (session token and network URL) from remote source
async function fetchWorldConfig(worldId: string): Promise<{ sessionToken: string; networkUrl: string }> {
  const remoteUrl = `https://${MSQUARED_WEBWORLDS_PROJECT}_${worldId}.msquared.world/`;

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
async function loadAndHydrateHtml(sessionToken: string, networkUrl: string, worldId: string, initialConfig: any): Promise<string> {
  const htmlTemplatePath = path.join(__dirname, '../../public/world.html');
  let htmlTemplate = await fs.readFile(htmlTemplatePath, 'utf-8');

  // Replace placeholders with actual values
  htmlTemplate = htmlTemplate
    .replace('PLACEHOLDER_SESSION_TOKEN', sessionToken)
    .replace('PLACEHOLDER_NETWORK_URL', networkUrl)
    .replace('PLACEHOLDER_WORLD_ID', worldId)
    .replace('PLACEHOLDER_INITIAL_CONFIG', JSON.stringify(initialConfig));

  return htmlTemplate;
}

// Extract allowed properties from parsed config for API updates
function sanitizeConfig(parsedConfig: any): any {
  return {
    name: parsedConfig.name,
    description: parsedConfig.description,
    generalConfiguration: parsedConfig.generalConfiguration,
    chatConfiguration: parsedConfig.chatConfiguration,
    authConfiguration: parsedConfig.authConfiguration,
    displayNameConfiguration: parsedConfig.displayNameConfiguration,
    environmentConfiguration: parsedConfig.environmentConfiguration,
    spawnConfiguration: parsedConfig.spawnConfiguration,
    avatarConfiguration: parsedConfig.avatarConfiguration,
    loadingConfiguration: parsedConfig.loadingConfiguration,
    allowOrbitalCamera: parsedConfig.allowOrbitalCamera,
    enableTweakPane: parsedConfig.enableTweakPane,
  };
}


function translateConfig(initialConfig: any): any {
  console.log(initialConfig);
  return {
    worldId: initialConfig.name,
    enableChat: initialConfig.chatConfiguration.enabled,
    mmlDocuments: initialConfig.mmlDocumentsConfiguration.mmlDocuments,
    environmentConfiguration: initialConfig.environmentConfiguration,
    spawnConfiguration: initialConfig.spawnConfiguration,
    avatarConfiguration: initialConfig.avatarConfiguration,
  };
}




// GET /world/:worldId/web -> returns the id provided
worldRouter.get('/:worldId/web', async (req: Request, res: Response) => {
  // try {

    const { worldId } = req.params;

    if (!MSQUARED_WEBWORLDS_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    const apiUrl = `${MSQUARED_WEBWORLDS_API_BASE}${MSQUARED_WEBWORLDS_PROJECT}/web-world-instances/${worldId}`;
    console.log(apiUrl);
    const configData = await internal.fetchRemoteWithAuth(apiUrl);
    
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configData);
    } catch (e) {
      return res.status(502).json({ error: 'Failed to parse API response' });
    }
    
    const { sessionToken, networkUrl } = await fetchWorldConfig(worldId);
    const initialConfig = translateConfig(parsedConfig);
    console.log(initialConfig);
    const htmlContent = await loadAndHydrateHtml(sessionToken, networkUrl, worldId, initialConfig);

    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlContent);
  // } catch (err) {
  //   return res.status(502).json({ error: 'Failed to retrieve connection details' });
  // }
});



// POST /world/:worldId/objects -> updates webworld config
worldRouter.post('/:worldId/objects', async (req: Request, res: Response) => {
  try {
    const { worldId } = req.params;
    
    if (!MSQUARED_WEBWORLDS_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    const apiUrl = `${MSQUARED_WEBWORLDS_API_BASE}${MSQUARED_WEBWORLDS_PROJECT}/web-world-instances/${worldId}`;
    console.log(apiUrl);
    const configData = await internal.fetchRemoteWithAuth(apiUrl);
    
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configData);
    } catch (e) {
      return res.status(502).json({ error: 'Failed to parse API response' });
    }

    // Create new config with only allowed properties
    const newConfig = {
      ...sanitizeConfig(parsedConfig),
      mmlDocumentsConfiguration: {
        mmlDocuments: {} as { [key: string]: any }
      }
    };

    // Add MML documents from request body
    for (const [index, doc] of req.body.entries()) {
      newConfig.mmlDocumentsConfiguration.mmlDocuments[index] = doc;
    }

    // Update config on API
    await internal.postRemoteWithAuth(apiUrl, JSON.stringify(newConfig));
    
    return res.json(newConfig);
  } catch (err) {
    console.error('Failed to update webworld config:', err);
    return res.status(502).json({ error: 'Failed to update webworld config on API' });
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

// Helper: fetch remote binary data (for GLB files)
export function fetchRemoteBinary(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, (resp) => {
        if (resp.statusCode && resp.statusCode >= 400) {
          reject(new Error('Bad status code: ' + resp.statusCode));
          resp.resume();
          return;
        }
        const chunks: Buffer[] = [];
        resp.on('data', (chunk) => chunks.push(chunk));
        resp.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

// Helper: fetch remote JSON data with headers
export function fetchRemoteJson(url: string, headers: { [key: string]: string } = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: headers
    };

    lib
      .request(options, (resp) => {
        if (resp.statusCode && resp.statusCode >= 400) {
          reject(new Error('Bad status code: ' + resp.statusCode));
          resp.resume();
          return;
        }
        resp.setEncoding('utf8');
        let data = '';
        resp.on('data', (chunk) => (data += chunk));
        resp.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (e) {
            reject(new Error('Failed to parse JSON response'));
          }
        });
      })
      .on('error', reject)
      .end();
  });
}

// Helper: post JSON data to remote URL with headers
export function postRemoteJson(url: string, data: any, headers: { [key: string]: string } = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = lib
      .request(options, (resp) => {
        if (resp.statusCode && resp.statusCode >= 400) {
          reject(new Error('Bad status code: ' + resp.statusCode));
          resp.resume();
          return;
        }
        resp.setEncoding('utf8');
        let responseData = '';
        resp.on('data', (chunk) => (responseData += chunk));
        resp.on('end', () => {
          try {
            const jsonData = JSON.parse(responseData);
            resolve(jsonData);
          } catch (e) {
            reject(new Error('Failed to parse JSON response'));
          }
        });
      })
      .on('error', reject);

    req.write(postData);
    req.end();
  });
}

// Namespace object to facilitate test mocking (jest.spyOn(worldModule.internal, 'fetchRemote'))
export const internal = {
  fetchRemote,
  fetchRemoteBinary,
  fetchRemoteJson,
  postRemoteJson,
  fetchRemoteWithAuth,
  postRemoteWithAuth,
  extractFirstScript,
  extractJsonBetweenBraces,
  fetchWorldConfig,
  loadAndHydrateHtml,
  extractAllowedConfigProperties: sanitizeConfig
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
