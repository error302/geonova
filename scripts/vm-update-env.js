#!/usr/bin/env node
/**
 * Update .env.local on the VM with:
 * - Correct SMTP app password
 * - PayPal sandbox mode (live creds are invalid)
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(require('os').homedir(), '.ssh', 'id_ed25519');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VM, updating .env.local...');
  
  // Build the sed commands to update .env.local
  const cmds = [
    // Update SMTP password
    `sed -i 's/^SMTP_PASS=.*/SMTP_PASS=zihw pdrv fmol kppz/' ~/metardu/.env.local`,
    // Update SMTP user (fix potential typo - was mohameddosh20, should be mohameddosho20)
    `sed -i 's/^SMTP_USER=.*/SMTP_USER=mohameddosho20@gmail.com/' ~/metardu/.env.local`,
    // Switch PayPal to sandbox mode (live creds are invalid)
    `sed -i 's/^PAYPAL_MODE=.*/PAYPAL_MODE=sandbox/' ~/metardu/.env.local`,
    // Verify changes
    `echo '=== SMTP ===' && grep -E '^SMTP_' ~/metardu/.env.local`,
    `echo '=== PAYPAL_MODE ===' && grep -E '^PAYPAL_MODE' ~/metardu/.env.local`,
  ].join(' && ');

  conn.exec(cmds, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); process.exit(1); }
    let stdout = '', stderr = '';
    stream.on('data', (d) => { stdout += d; process.stdout.write(d); });
    stream.stderr.on('data', (d) => { stderr += d; process.stderr.write(d); });
    stream.on('close', () => {
      console.log('\n.env.local updated successfully');
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
});
