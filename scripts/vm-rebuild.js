#!/usr/bin/env node
/**
 * Rebuild Docker container on VM
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(require('os').homedir(), '.ssh', 'id_ed25519');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VM, rebuilding Docker container...');
  
  const cmds = [
    'cd ~/metardu',
    'docker compose build metardu-app 2>&1 | tail -30',
    'echo "=== BUILD DONE ==="',
    'docker compose up -d metardu-app 2>&1',
    'echo "=== UP DONE ==="',
    'sleep 10',
    'docker ps 2>&1',
    'echo "=== HEALTH CHECK ==="',
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
  privateKey: fs.readFileSync(path.join(require('os').homedir(), '.ssh', 'oracle-metardu.key')),
  readyTimeout: 600000,
  keepaliveInterval: 10000,
});
