import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchCoscineApplicationProfile,
  fetchCoscineFileContent,
  fetchCoscineResourceDetails,
  scanCoscine,
} from './coscineClient.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '1mb' }));

app.post('/api/coscine/scan', async (req, res) => {
  const { apiKey } = req.body ?? {};

  if (!apiKey) {
    res.status(400).json({ message: 'API key is required.' });
    return;
  }

  try {
    const result = await scanCoscine({ apiKey });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Could not connect to Coscine.',
      details: error.details,
    });
  }
});

app.post('/api/coscine/resource-details', async (req, res) => {
  const { apiKey, projectId, resourceId } = req.body ?? {};

  if (!apiKey || !projectId || !resourceId) {
    res.status(400).json({ message: 'API key, project ID, and resource ID are required.' });
    return;
  }

  try {
    const result = await fetchCoscineResourceDetails({ apiKey, projectId, resourceId });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Could not load Coscine resource details.',
      details: error.details,
    });
  }
});

app.post('/api/coscine/application-profile', async (req, res) => {
  const { apiKey, profileUri } = req.body ?? {};

  if (!apiKey || !profileUri) {
    res.status(400).json({ message: 'API key and application profile URI are required.' });
    return;
  }

  try {
    const result = await fetchCoscineApplicationProfile({ apiKey, profileUri });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Could not load Coscine application profile.',
      details: error.details,
    });
  }
});

app.post('/api/coscine/download', async (req, res) => {
  const { apiKey, projectId, resourceId, path: filePath } = req.body ?? {};

  if (!apiKey || !projectId || !resourceId || !filePath) {
    res.status(400).json({ message: 'API key, project ID, resource ID, and file path are required.' });
    return;
  }

  try {
    const upstreamResponse = await fetchCoscineFileContent({
      apiKey,
      projectId,
      resourceId,
      path: filePath,
    });
    const headers = Object.fromEntries(upstreamResponse.headers.entries());

    res.status(upstreamResponse.status);
    res.setHeader('content-type', headers['content-type'] || 'application/octet-stream');
    if (headers['content-length']) {
      res.setHeader('content-length', headers['content-length']);
    }
    res.setHeader(
      'content-disposition',
      `attachment; filename="${encodeURIComponent(String(filePath).split('/').pop() || 'download')}"`,
    );

    if (upstreamResponse.body) {
      for await (const chunk of upstreamResponse.body) {
        res.write(chunk);
      }
    }
    res.end();
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Could not download Coscine file.',
      details: error.details,
    });
  }
});

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, '127.0.0.1', () => {
  console.log(`Coscine proxy listening on http://127.0.0.1:${port}`);
});
