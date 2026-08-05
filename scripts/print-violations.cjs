// One-off: print aria-label gate violations compactly (file:line [value])
const d = JSON.parse(require('fs').readFileSync(process.argv[2] || 'aria-violations.json', 'utf8'))
for (const v of d.violations) {
  console.log(v.file.replace(/\\/g, '/') + ':' + v.line + '  [' + v.value + ']')
}
