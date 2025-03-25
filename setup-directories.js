const fs = require('fs');
const path = require('path');

// Directory structure
const directories = [
  'server',
  'overlay',
  'customization',
  'extension'
];

// Create directories if they don't exist
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

console.log('Directory structure setup complete!');