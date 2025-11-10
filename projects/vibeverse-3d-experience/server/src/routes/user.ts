import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/user';
import { postRemoteWithAuth } from '../helpers/api';
import { renderTemplate } from '../helpers/templates';

export const userRouter = Router();

// Extend session types
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

// API configuration (same as admin routes)
const MSQUARED_WEBWORLDS_PROJECT = process.env.MSQUARED_WEBWORLDS_PROJECT || 'vibeverse-custom-df556d';
const MSQUARED_WEBWORLDS_API_BASE = process.env.MSQUARED_WEBWORLDS_API_BASE || 'https://api.msquared.io/v1/worlds/';
const MSQUARED_WEBWORLDS_API_KEY = process.env.MSQUARED_WEBWORLDS_API_KEY || '';

// Helper function to validate world name
function validateWorldName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

// Helper function to create world via API
async function createWorldForUser(worldName: string): Promise<string> {
  const apiUrl = `${MSQUARED_WEBWORLDS_API_BASE}${MSQUARED_WEBWORLDS_PROJECT}/web-world-instances/`;
  const payload = JSON.stringify({ name: worldName });
  
  const responseData = await postRemoteWithAuth(apiUrl, payload);
  const response = JSON.parse(responseData);
  
  if (!response.id) {
    throw new Error('No ID in response from world creation API');
  }
  
  return response.id;
}

// Landing page at /
userRouter.get('/', (req: Request, res: Response) => {
  const data = {
    loggedIn: !!req.session.userId
  };
  
  const html = renderTemplate('landing', data);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Sign up page
userRouter.get('/signup', (req: Request, res: Response) => {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  
  const data = {
    error: req.query.error
  };
  
  const html = renderTemplate('signup', data);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Handle sign up form submission
userRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, confirmPassword, worldName } = req.body;
    
    // Validation
    if (!email || !password || !confirmPassword || !worldName) {
      return res.redirect('/signup?error=All fields are required');
    }
    
    if (password !== confirmPassword) {
      return res.redirect('/signup?error=Passwords do not match');
    }
    
    if (!validateWorldName(worldName)) {
      return res.redirect('/signup?error=World name must be lowercase, numbers, and dashes only');
    }
    
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.redirect('/signup?error=Email already registered');
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create world first
    let worldId: string;
    try {
      worldId = await createWorldForUser(worldName);
    } catch (error) {
      console.error('Failed to create world:', error);
      return res.redirect('/signup?error=Failed to create world. Please try again.');
    }
    
    // Create user with world ID
    const user = await UserModel.create({
      email,
      password_hash: passwordHash,
      world_id: worldId
    });
    
    // Log user in
    req.session.userId = user.id;
    
    res.redirect('/home');
  } catch (error) {
    console.error('Signup error:', error);
    res.redirect('/signup?error=An error occurred. Please try again.');
  }
});

// Sign in page
userRouter.get('/signin', (req: Request, res: Response) => {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  
  const data = {
    error: req.query.error
  };
  
  const html = renderTemplate('signin', data);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Handle sign in form submission
userRouter.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.redirect('/signin?error=Email and password are required');
    }
    
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.redirect('/signin?error=Invalid email or password');
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.redirect('/signin?error=Invalid email or password');
    }
    
    // Set session and save explicitly
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/signin?error=Session error. Please try again.');
      }
      console.log('User signed in successfully:', { userId: user.id, sessionId: req.sessionID });
      res.redirect('/home');
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.redirect('/signin?error=An error occurred. Please try again.');
  }
});

// Home page for logged in users
userRouter.get('/home', async (req: Request, res: Response) => {
  console.log('Home page accessed:', { 
    sessionId: req.sessionID, 
    userId: req.session.userId,
    hasSession: !!req.session,
    sessionKeys: Object.keys(req.session || {})
  });
  
  if (!req.session.userId) {
    console.log('No userId in session, redirecting to signin');
    return res.redirect('/signin');
  }
  
  try {
    const user = await UserModel.findById(req.session.userId);
    if (!user) {
      console.log('User not found in database, clearing session');
      req.session.userId = undefined;
      return res.redirect('/signin');
    }
    
    console.log('User found, rendering home page:', { userId: user.id, email: user.email });
    
    const data = {
      email: user.email,
      worldId: user.world_id,
      subscribed: user.subscribed,
      memberSince: user.created_at.toLocaleDateString()
    };
    
    const html = renderTemplate('home', data);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Home page error:', error);
    res.status(500).send('An error occurred');
  }
});

// Subscribe page
userRouter.get('/subscribe', async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.redirect('/signin');
  }
  
  const html = renderTemplate('subscribe');
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Handle subscription (placeholder - you'd integrate with a payment processor)
userRouter.post('/subscribe', async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.redirect('/signin');
  }
  
  try {
    // In a real app, you'd process payment here
    await UserModel.updateSubscription(req.session.userId, true);
    res.redirect('/home');
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).send('An error occurred');
  }
});

// Sign out
userRouter.post('/signout', (req: Request, res: Response) => {
  req.session.userId = undefined;
  res.redirect('/');
});

userRouter.get('/signout', (req: Request, res: Response) => {
  req.session.userId = undefined;
  res.redirect('/');
});