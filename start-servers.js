const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  main: '\x1b[36m',    // Cyan
  highlight: '\x1b[35m', // Magenta
  dashboard: '\x1b[32m', // Green
  error: '\x1b[31m',   // Red
  info: '\x1b[33m'     // Yellow
};

// Function to start a server process
function startServer(script, name, color) {
  console.log(`${color}Starting ${name} server...${colors.reset}`);
  
  const serverPath = path.join(__dirname, 'server', script);
  const server = spawn('node', [serverPath]);
  
  server.stdout.on('data', (data) => {
    console.log(`${color}[${name}] ${data.toString().trim()}${colors.reset}`);
  });
  
  server.stderr.on('data', (data) => {
    console.error(`${colors.error}[${name} ERROR] ${data.toString().trim()}${colors.reset}`);
  });
  
  server.on('close', (code) => {
    console.log(`${color}[${name}] Server process exited with code ${code}${colors.reset}`);
    
    // Restart server if it crashed
    if (code !== 0 && code !== null) {
      console.log(`${colors.info}[${name}] Restarting server in 5 seconds...${colors.reset}`);
      setTimeout(() => {
        startServer(script, name, color);
      }, 5000);
    }
  });
  
  return server;
}

// Start all servers
const mainServer = startServer('server.js', 'Main Chat', colors.main);
const highlightServer = startServer('highlight-server.js', 'Highlight Messages', colors.highlight);
const customizationServer = startServer('customization-server.js', 'Customization Dashboard', colors.dashboard);

// Display URLs for access
console.log(`
${colors.info}==========================================================
  Multi-Platform Chat Overlay
==========================================================

  Add these URLs as Browser Sources in OBS:

  ${colors.main}Main Chat Overlay: http://localhost:3000${colors.info}
  ${colors.highlight}Highlighted Messages: http://localhost:3001${colors.info}
  ${colors.dashboard}Customization Dashboard: http://localhost:3002${colors.info}

  Press [Ctrl+C] to stop all servers
==========================================================${colors.reset}
`);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.info}Shutting down all servers...${colors.reset}`);
  
  mainServer.kill();
  highlightServer.kill();
  customizationServer.kill();
  
  console.log(`${colors.info}All servers have been stopped.${colors.reset}`);
  process.exit(0);
});

// Create interface for user input if needed
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
    process.emit('SIGINT');
  }
});