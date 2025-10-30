import express from 'express';
import { worldRouter } from './routes/world';
import path from 'path';

const app = express();
app.use(express.json());

// Static route for web client build files
const clientBuildPath = path.join(__dirname, '../../client/build');
app.use('/web-client', express.static(clientBuildPath));

app.use('/world', worldRouter);

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default app;
