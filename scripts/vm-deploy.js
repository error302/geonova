#!/usr/bin/env node
/**
 * Deploy to VM: git pull + docker compose build + up
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

function getSshKey() {
  const sshDir = path.join(require('os').homedir(), '.ssh');
  for (const name of ['oracle-metardu.key', 'id_rsa', 'id_ed25519']) {
    const full = path.join(sshDir, name);
    if (fs.existsSync(full)) return fs.readFileSync(full);
  }
  throw new Error('No valid SSH key found in ~/.ssh/');
}

const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VM, deploying...');
  
  const cmds = [
    'cd ~/metardu',
    'git pull origin main 2>&1',
    'echo "=== GIT PULL DONE ==="',
    // Rebuild just the web container (fastest)
    'docker compose build metardu-app 2>&1 | tail -20',
    'echo "=== BUILD DONE ==="',
    // Restart the web container with the new code
    'docker compose up -d metardu-app 2>&1',
    'echo "=== RESTART DONE ==="',
    // Wait for health check
    'sleep 5',
    'curl -s http://localhost:3000/api/public/health 2>&1',
  ].join(' && ');

  conn.exec(cmds, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); process.exit(1); }
    stream.on('data', (d) => { process.stdout.write(d); });
    stream.stderr.on('data', (d) => { process.stderr.write(d); });
    stream.on('close', () => {
      console.log('\nDeploy complete');
      conn.end();
      process.exit(0);
    });
  });
}).on('error', (err) => {
  console.error('SSH connection error:', err.message);
  process.exit(1);
}).connect({
  host: '84.8.133.9',
  port: 22,
  username: 'opc',
  privateKey: getSshKey(),
  readyTimeout: 60000,
  // Long timeout for build
  keepaliveInterval: 10000,
});
