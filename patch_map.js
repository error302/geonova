const fs = require('fs');
const file = 'src/app/map/components/MapToolDock.tsx';
let data = fs.readFileSync(file, 'utf8');

// Replace transparent backdrops with solid opaque backgrounds for map
data = data.replace(/bg-\[var\(--bg-secondary\)]\/[0-9]+/g, 'bg-[var(--bg-secondary)]');
data = data.replace(/backdrop-blur-xl/g, '');
data = data.replace(/backdrop-blur-2xl/g, '');
data = data.replace(/backdrop-blur-md/g, '');

fs.writeFileSync(file, data);
