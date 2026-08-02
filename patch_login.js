const fs = require('fs');
const file = 'src/app/login/page.tsx';
let data = fs.readFileSync(file, 'utf8');

// Make text whiter/more opaque
data = data.replace(/text-white\/60/g, 'text-white/90');
data = data.replace(/text-white\/40/g, 'text-white/80');
data = data.replace(/text-white\/70/g, 'text-white/90');
data = data.replace(/text-white\/75/g, 'text-white/90');
data = data.replace(/placeholder-white\/30/g, 'placeholder-white/60');
data = data.replace(/bg-white\/5/g, 'bg-white/10');
data = data.replace(/bg-black\/40/g, 'bg-black/60');

fs.writeFileSync(file, data);
