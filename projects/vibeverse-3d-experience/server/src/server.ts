import express from 'express';
import session from 'express-session';
const connectPgSimple = require('connect-pg-simple');
import { worldRouter } from './routes/world';
import { objectRouter } from './routes/objects';
import { searchRouter } from './routes/search';
import { adminRouter } from './routes/admin';
import { userRouter } from './routes/user';
import { initializeDatabase } from './models/user';
import path from 'path';

// Load environment variables from .env file
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, environment variables should be set another way
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database connection
initializeDatabase();

// Trust proxy for Vercel deployment
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Session configuration
const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL || 'postgresql://vibeverse:vibeverse_dev_password@localhost:5432/vibeverse',
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}) as any);

// Static route for web client build files
const clientBuildPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../dist/client/build')
  : path.join(__dirname, '../client/build');

// Debug logging for production
if (process.env.NODE_ENV === 'production') {
  console.log('__dirname:', __dirname);
  console.log('Client build path:', clientBuildPath);
  try {
    const fs = require('fs');
    console.log('Files in __dirname:', fs.readdirSync(__dirname));
    if (fs.existsSync(path.join(__dirname, '../dist'))) {
      console.log('Files in dist:', fs.readdirSync(path.join(__dirname, '../dist')));
      if (fs.existsSync(path.join(__dirname, '../dist/client'))) {
        console.log('Files in dist/client:', fs.readdirSync(path.join(__dirname, '../dist/client')));
      }
    }
  } catch (e) {
    console.log('Error checking files:', e instanceof Error ? e.message : String(e));
  }
}

app.use('/web-client', express.static(clientBuildPath));

// Debug route for production
if (process.env.NODE_ENV === 'production') {
  app.get('/debug-paths', (req, res) => {
    const fs = require('fs');
    try {
      const info = {
        __dirname,
        clientBuildPath,
        clientPathExists: fs.existsSync(clientBuildPath),
        distExists: fs.existsSync(path.join(__dirname, '../dist')),
        rootFiles: fs.readdirSync(path.join(__dirname, '..')),
      };
      res.json(info);
    } catch (e) {
      res.json({ error: e instanceof Error ? e.message : String(e) });
    }
  });
}

// Static route for assets
const assetsPath = path.join(__dirname, '../assets');
app.use('/assets', express.static(assetsPath));

// User routes (at root level)
app.use('/', userRouter);

// Other routes
app.use('/admin', adminRouter);
app.use('/world', worldRouter);
app.use('/objects', objectRouter);
app.use('/search', searchRouter);

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default app;
