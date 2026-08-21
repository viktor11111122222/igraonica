// Dev server preko HTTPS-a, za testiranje skenera na telefonu.
//
// iOS Safari daje pristup kameri samo u "secure context"-u, pa obican
// http://<ip>:5173 nikad ne dobije kameru. Ovaj config je isti kao osnovni,
// samo dodaje sertifikat i otvara server ka mrezi.
//
// Pokretanje:  npx vite --config vite.config.https.js
// Sertifikati se prave van repo-a (vidi SSL_CERT_DIR ispod).
import { defineConfig, mergeConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import base from './vite.config.js';

const CERT_DIR =
  process.env.SSL_CERT_DIR ||
  path.resolve(process.env.HOME, '.local/share/igraonica-dev-certs');

export default mergeConfig(
  base,
  defineConfig({
    server: {
      host: true,
      https: {
        key: fs.readFileSync(path.join(CERT_DIR, 'server.key')),
        cert: fs.readFileSync(path.join(CERT_DIR, 'server.crt')),
      },
    },
  })
);
