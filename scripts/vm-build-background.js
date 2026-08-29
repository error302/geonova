#!/usr/bin/env node
/**
 * Quick deploy: copy changed files directly into the running container 
 * and restart it. Avoids a full Docker rebuild (which takes 10+ min on the VM).
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(require('os').homedir(), '.ssh', 'id_ed25519');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VM, quick-deploying...');
  
  // Since Next.js runs from standalone output, we need to copy new files 
  // into the container's /app directory. But the standalone server only serves
  // pre-built pages from .next/standalone — so we need a full rebuild.
  // 
  // Alternative: rebuild in background and swap when done.
  
  const cmds = `cd ~/metardu; nohup docker compose build web > /tmp/docker-build.log 2>&1 & echo "Build started. PID: $!"; echo "Monitor: tail -f /tmp/docker-build.log"`;

  conn.exec(cmds, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); process.exit(1); }
    stream.on('data', (d) => { process.stdout.write(d); });
    stream.stderr.on('data', (d) => { process.stderr.write(d); });
    stream.on('close', () => {
      console.log('\nBuild started in background');
      conn.end();
      process.exit(0);
    });
  });
}).on('error', (err) => {
  console.error('SSH connection error:', err.message);
  process.exit(1);
}).connect({
  // SECURITY (audit C-01): connection details from env — no hosts/creds in source
  host: process.env.VM_HOST,
  port: 22,
  username: process.env.VM_USER || 'opc',
  privateKey: fs.readFileSync(keyPath),
  readyTimeout: 30000,
  keepaliveInterval: 10000,
});
