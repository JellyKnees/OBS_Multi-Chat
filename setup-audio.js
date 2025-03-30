const fs = require('fs');
const path = require('path');

// Create audio directory in server folder
const audioDir = path.join(__dirname, 'server', 'audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log(`Created audio directory: ${audioDir}`);
} else {
    console.log(`Audio directory already exists: ${audioDir}`);
}

// Check if the whoosh.mp3 file exists in the repository
const repoWhooshPath = path.join(__dirname, 'whoosh.mp3');
const targetWhooshPath = path.join(audioDir, 'whoosh.mp3');

// Copy the whoosh sound file to the audio directory
if (fs.existsSync(repoWhooshPath)) {
    fs.copyFileSync(repoWhooshPath, targetWhooshPath);
    console.log(`Copied whoosh.mp3 to ${targetWhooshPath}`);
} else {
    console.log('Warning: whoosh.mp3 not found in the repository root.');
    
    // Create a placeholder file with a note if the sound doesn't exist
    if (!fs.existsSync(targetWhooshPath)) {
        fs.writeFileSync(targetWhooshPath, 'This is a placeholder. Replace with an actual whoosh.mp3 file.');
        console.log('Created a placeholder file. Please replace it with an actual whoosh.mp3 sound file.');
    }
}

console.log('Audio setup complete!');