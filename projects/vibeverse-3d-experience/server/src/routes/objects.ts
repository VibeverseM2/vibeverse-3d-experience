import { Router, Request, Response } from 'express';
import { fetchRemoteJson, fetchRemoteBinary } from './world';

export const objectRouter = Router();

// Mash.space API configuration
const MASH_SPACE_API_KEY = process.env.MASH_SPACE_API_KEY || 'U3znjbTC5gGMPhhyJ1dpsOiplsKbO8ma8Kp5HEUjLn4';
const MASH_SPACE_API_BASE = 'https://mash.space/api';

// In-memory storage for GLB files
const glbCache = new Map<string, Buffer>();

// GET /:objectId/mml -> creates MML for object ID
objectRouter.get('/:objectId/mml', async (req: Request, res: Response) => {
  try {
    const { objectId } = req.params;

    // Return the GLB URL using object ID
    const glbUrl = `http://localhost:3000/objects/${objectId}/glb`;

    const mmlContent = `<m-model src="${glbUrl}"></m-model>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(mmlContent);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to create MML for object' });
  }
});

// GET /:objectId/glb -> serves the GLB file for object ID
objectRouter.get('/:objectId/glb', async (req: Request, res: Response) => {
  try {
    const { objectId } = req.params;

    // Create a cache key using object ID only
    const cacheKey = objectId;

    // Check if GLB data is already cached
    let glbData = glbCache.get(cacheKey);

    if (!glbData) {
      // If not cached, fetch download URL from mash.space API first
      const downloadData = await fetchRemoteJson(`${MASH_SPACE_API_BASE}/data/${objectId}/download`, {
        'x-api-key': MASH_SPACE_API_KEY
      });

      if (!downloadData.url) {
        return res.status(404).json({ error: 'No download URL found for object ID' });
      }

      // Fetch the GLB file from the download URL
      glbData = await fetchRemoteBinary(downloadData.url);
      
      // Store it in memory cache
      glbCache.set(cacheKey, glbData);
    }

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Length', glbData.length);
    return res.send(glbData);
  } catch (err) {
    console.error('Error serving GLB file:', err);
    return res.status(502).json({ error: 'Failed to fetch GLB file' });
  }
});