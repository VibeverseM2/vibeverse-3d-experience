import { Router, Request, Response } from 'express';
import { fetchRemoteJson, postRemoteJson } from './world';

export const searchRouter = Router();

// Mash.space API configuration
const MASH_SPACE_API_KEY = process.env.MASH_SPACE_API_KEY || 'U3znjbTC5gGMPhhyJ1dpsOiplsKbO8ma8Kp5HEUjLn4';
const MASH_SPACE_API_BASE = 'https://mash.space/api';

// GET /?q=searchTerm -> searches mash.space API and returns objects with name, id
searchRouter.get('/', async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    
    if (!searchTerm || !searchTerm.trim()) {
      return res.status(400).json({ error: 'Search term is required. Use ?q=searchTerm' });
    }

    // Search mash.space API
    const searchData = await postRemoteJson(`${MASH_SPACE_API_BASE}/search`, {
      queries: [{
        prompt: searchTerm.trim(),
        k: 15
      }]
    }, {
      'x-api-key': MASH_SPACE_API_KEY,
      'Content-Type': 'application/json'
    });

    const results = searchData.results;
    
    if (!results) {
      return res.json([]); // Return empty array if no results
    }

    // Get the first (and likely only) key in results
    const searchKey = Object.keys(results)[0];
    if (!searchKey || !results[searchKey]) {
      return res.json([]); // Return empty array if no search results
    }

    const searchResults = results[searchKey];
    if (!Array.isArray(searchResults)) {
      console.warn('Search results is not an array:', searchResults);
      return res.json([]);
    }

    // Fetch download URLs for each result in parallel to validate they exist
    const downloadPromises = searchResults.map(async (item: { name: string; id: string }) => {
      try {
        const downloadData = await fetchRemoteJson(`${MASH_SPACE_API_BASE}/data/${item.id}/download`, {
          'x-api-key': MASH_SPACE_API_KEY
        });

        if (!downloadData.url) {
          console.warn(`No URL found in download response for ${item.id}`);
          return null;
        }

        return {
          name: item.name,
          id: item.id
        };
      } catch (error) {
        console.error(`Error fetching download URL for ${item.id}:`, error);
        return null;
      }
    });

    // Wait for all download requests to complete
    const downloadResults = await Promise.all(downloadPromises);
    
    // Filter out failed requests
    const validResults = downloadResults.filter(result => result !== null);
    
    return res.json(validResults);
  } catch (error) {
    console.error('Error in search route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});