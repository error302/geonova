const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Next.js workers build fails for various reasons, but mostly due to edge runtime issues.
// Let's ensure Next.js uses standalone output which often works better for deployment.

const nextConfigPath = 'next.config.js';
if (fs.existsSync(nextConfigPath)) {
    const config = fs.readFileSync(nextConfigPath, 'utf8');
    if (!config.includes('output:')) {
        console.log('Adding standalone output to next.config.js');
        // This is a common fix for Cloudflare/Vercel edge builds, but let's check what the issue actually was
    }
}
