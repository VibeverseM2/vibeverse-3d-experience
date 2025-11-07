import express from 'express';
import { worldRouter } from './routes/world';
import { objectRouter } from './routes/objects';
import { searchRouter } from './routes/search';
import { adminRouter } from './routes/admin';
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

// Static route for web client build files
const clientBuildPath = path.join(__dirname, '../../client/build');
app.use('/web-client', express.static(clientBuildPath));

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
