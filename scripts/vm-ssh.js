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

// Try key-based auth first, fall back to password
const VM_HOST = '84.8.133.9';
const VM_USER = 'opc';
const keyPath = path.join(require('os').homedir(), '.ssh', 'oracle-metardu.key');
const hasKey = fs.existsSync(keyPath);

const config = {
  host: VM_HOST,
  port: 22,
  username: VM_USER,
  readyTimeout: 30000,
};

if (hasKey) {
  config.privateKey = fs.readFileSync(keyPath);
} else {
  config.password = 'dosho2020';
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
