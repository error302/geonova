const fs = require('fs')

const content = fs.readFileSync('src/app/tools/survey-plan-demo/page.tsx', 'utf8')

console.log(content.includes('<html') || content.includes('<title>'))
