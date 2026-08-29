#!/usr/bin/env node
/**
 * VM SSH helper — runs a command on the GCP VM via ssh2
 * Usage: node scripts/vm-ssh.js "command"
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const cmd = process.argv.slice(2).join(' ') || 'echo hello';
const conn = new Client();

// SECURITY (audit C-01, 2026-08-30): host/user/password come from the
// environment — no credentials in source. Key-based auth is preferred.
const VM_HOST = process.env.VM_HOST;
const VM_USER = process.env.VM_USER || 'opc';
const VM_PASSWORD = process.env.VM_PASSWORD; // optional fallback
const keyPath = path.join(require('os').homedir(), '.ssh', 'oracle-metardu.key');
const hasKey = fs.existsSync(keyPath);

if (!VM_HOST) {
  console.error('ERROR: VM_HOST environment variable is required');
  process.exit(1);
}

const config = {
  host: VM_HOST,
  port: 22,
  username: VM_USER,
  readyTimeout: 30000,
};

if (hasKey) {
  config.privateKey = fs.readFileSync(keyPath);
} else if (VM_PASSWORD) {
  config.password = VM_PASSWORD;
} else {
  console.error('ERROR: no SSH key at ' + keyPath + ' and no VM_PASSWORD set');
  process.exit(1);
}

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); process.exit(1); }
    let stdout = '', stderr = '';
    stream.on('data', (d) => { stdout += d; process.stdout.write(d); });
    stream.stderr.on('data', (d) => { stderr += d; process.stderr.write(d); });
    stream.on('close', () => { conn.end(); process.exit(stderr ? 1 : 0); });
  });
}).on('error', (err) => {
  console.error('SSH connection error:', err.message);
  process.exit(1);
}).connect(config);
