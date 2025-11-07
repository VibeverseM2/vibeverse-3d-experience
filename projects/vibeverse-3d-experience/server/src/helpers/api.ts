import https from 'https';
import http from 'http';

// API configuration
const MSQUARED_WEBWORLDS_API_KEY = process.env.MSQUARED_WEBWORLDS_API_KEY || '';

// Helper: POST data to remote URL with authorization header
export function postRemoteWithAuth(url: string, data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MSQUARED_WEBWORLDS_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = lib.request(options, (resp) => {
      if (resp.statusCode && resp.statusCode >= 400) {
        reject(new Error('Bad status code: ' + resp.statusCode));
        resp.resume();
        return;
      }
      resp.setEncoding('utf8');
      let responseData = '';
      resp.on('data', (chunk) => (responseData += chunk));
      resp.on('end', () => resolve(responseData));
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Helper: fetch remote URL with authorization header
export function fetchRemoteWithAuth(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'Authorization': `Bearer ${MSQUARED_WEBWORLDS_API_KEY}`
      }
    };
    
    lib
      .get(url, options, (resp) => {
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