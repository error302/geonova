const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const key = fs.readFileSync(path.join(require('os').homedir(), '.ssh/oracle-metardu.key'));
const conn = new Client();

conn.on('ready', () => {
  const cmds = [
    'echo "=== CLOUDFLARED CONTAINER LOGS ==="',
    'docker logs metardu-cloudflared --tail 50 2>&1',
    'echo "=== COLLABORATION CONTAINER LOGS ==="',
    'docker logs metardu-collaboration --tail 50 2>&1'
  ].join(' && ');

  conn.exec(cmds, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '84.8.133.9', port: 22, username: 'opc', privateKey: key });
