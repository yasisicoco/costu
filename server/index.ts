import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createApp } from './app';

const { app, httpServer } = createApp();
const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, '0.0.0.0', () => console.log(`costu server: http://localhost:${port}`));
