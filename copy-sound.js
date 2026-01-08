// Quick script to copy the Jurassic Park sound file to public directory
const fs = require('fs');
const path = require('path');

const sourcePath = '/mnt/user-data/uploads/didn_t-say-the-magic-word-made-with-Voicemod.mp3';
const destPath = path.join(__dirname, 'public', 'jurassic-park-sound.mp3');

try {
  fs.copyFileSync(sourcePath, destPath);
  console.log('✅ Jurassic Park sound copied successfully to:', destPath);
} catch (err) {
  console.error('❌ Error copying file:', err);
  process.exit(1);
}
