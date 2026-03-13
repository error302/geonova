const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  // Background
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, size, size)
  
  // Amber rounded square
  const padding = size * 0.1
  const cornerRadius = size * 0.15
  ctx.fillStyle = '#E8841A'
  ctx.beginPath()
  ctx.roundRect(padding, padding, size - padding * 2, size - padding * 2, cornerRadius)
  ctx.fill()
  
  // Text
  ctx.fillStyle = '#0a0a0f'
  ctx.font = `bold ${size * 0.4}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('GN', size / 2, size / 2)
  
  const dir = path.join(__dirname, 'public', 'icons')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(path.join(dir, filename), canvas.toBuffer('image/png'))
  console.log(`Generated ${filename}`)
}

generateIcon(192, 'icon-192.png')
generateIcon(512, 'icon-512.png')
console.log('Icons generated successfully!')
