import { Router, Request, Response } from 'express';
import { postRemoteWithAuth, fetchRemoteWithAuth } from '../helpers/api';
import { renderTemplate } from '../helpers/templates';

export const adminRouter = Router();

// API configuration
const MSQUARED_WEBWORLDS_PROJECT = process.env.MSQUARED_WEBWORLDS_PROJECT || 'vibeverse-custom-df556d';
const MSQUARED_WEBWORLDS_API_BASE = process.env.MSQUARED_WEBWORLDS_API_BASE || 'https://api.msquared.io/v1/worlds/';
const MSQUARED_WEBWORLDS_API_KEY = process.env.MSQUARED_WEBWORLDS_API_KEY || '';

// GET /admin -> serves the admin HTML page
adminRouter.get('/', async (req: Request, res: Response) => {
  let data: any = {};
  
  try {
    // Fetch worlds from API
    const apiUrl = `${MSQUARED_WEBWORLDS_API_BASE}${MSQUARED_WEBWORLDS_PROJECT}/web-world-instances/`;
    const responseData = await fetchRemoteWithAuth(apiUrl);
    
    const response = JSON.parse(responseData);
    if (response.worlds && Array.isArray(response.worlds)) {
      data.worlds = response.worlds;
    }
  } catch (error) {
    console.error('Failed to fetch worlds from API:', error);
    data.errorMessage = 'Failed to load worlds from API';
  }
  
  const html = renderTemplate('admin', data);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// POST /admin/create -> creates a new world
adminRouter.post('/create', async (req: Request, res: Response) => {
  const { name } = req.body;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'World name is required' });
  }

  if (!MSQUARED_WEBWORLDS_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Post to external API
    const apiUrl = `${MSQUARED_WEBWORLDS_API_BASE}${MSQUARED_WEBWORLDS_PROJECT}/web-world-instances/`;
    const payload = JSON.stringify({ name });
    
    const responseData = await postRemoteWithAuth(apiUrl, payload);
    
    // Parse the response to get the world ID
    let worldId: string;
    try {
      const response = JSON.parse(responseData);
      worldId = response.id;
      if (!worldId) {
        throw new Error('No ID in response');
      }
    } catch (parseError) {
      console.error('Failed to parse API response:', parseError);
      return res.status(502).json({ error: 'Invalid response from external API' });
    }
    
    console.log(`Created world: ${name} with ID: ${worldId}`);
    
    // Redirect back to admin page
    res.redirect('/admin');
  } catch (error) {
    console.error('Failed to create world on API:', error);
    return res.status(502).json({ error: 'Failed to create world on external API' });
  }
});