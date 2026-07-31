const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const key = fs.readFileSync(path.join(require('os').homedir(), '.ssh/oracle-metardu.key'));
const conn = new Client();

conn.on('ready', () => {
  const cmds = [
    'echo "=== DOCKER PS ==="',
    'docker ps -a',
    'echo "=== MEMORY ==="',
    'free -h',
    'echo "=== APP LOGS (LAST 40 LINES) ==="',
    'docker logs metardu-app --tail 40 2>&1',
    'echo "=== CLOUDFLARED / REVERSE PROXY ==="',
    'sudo systemctl status cloudflared 2>&1 || ps aux | grep cloudflared'
  ].join(' && ');

  conn.exec(cmds, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).on('error', err => {
  console.error('SSH Error:', err);
}).connect({ host: '84.8.133.9', port: 22, username: 'opc', privateKey: key });
