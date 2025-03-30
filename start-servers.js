const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  main: '\x1b[36m',    // Cyan
  highlight: '\x1b[35m', // Magenta
  dashboard: '\x1b[32m', // Green
  error: '\x1b[31m',   // Red
  info: '\x1b[33m',     // Yellow
  success: '\x1b[92m'   // Bright green
};

// Function to ensure directories exist
function ensureDirectoriesExist() {
  console.log(`${colors.info}Checking required directories...${colors.reset}`);
  
  const directories = [
    'server',
    'overlay',
    'customization',
    'extension'
  ];
  
  directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`${colors.info}Creating directory: ${dir}${colors.reset}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  
  console.log(`${colors.success}Directory check complete!${colors.reset}`);
}

// Function to ensure settings file exists
function ensureSettingsExist() {
  const settingsPath = path.join(__dirname, 'server', 'settings.json');
  
  if (!fs.existsSync(settingsPath)) {
    console.log(`${colors.info}Creating default settings file...${colors.reset}`);
    
    // Default settings object
    const defaultSettings = {
      messageLimit: 50,
      highlightTimeout: 10000,
      highlightColor: "#ff5500",
      obsView: {
        fontSize: 16,
        textColor: "#ffffff",
        backgroundColor: "#222222",
        messageBackgroundColor: "#222222",
        messageOpacity: 0.7,
        messageBorderRadius: 4,
        messagePadding: 8,
        chatWidth: "100%",
        chatHeight: "400px",
        enableDropShadow: true,
        theme: "dark",
        showBadges: true,
        showTimestamps: false,
        showPlatforms: true,
        showMessageBackground: true
      },
      streamerView: {
        fontSize: 16,
        textColor: "#ffffff",
        backgroundColor: "#181818",
        messageBackgroundColor: "#222222",
        messageOpacity: 0.7,
        messageBorderRadius: 4,
        messagePadding: 8,
        chatWidth: "100%",
        chatHeight: "400px",
        enableDropShadow: true,
        theme: "dark",
        showBadges: true,
        showTimestamps: false,
        showPlatforms: true
      }
    };
    
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
      console.log(`${colors.success}Default settings created!${colors.reset}`);
    } catch (error) {
      console.error(`${colors.error}Error creating settings file: ${error}${colors.reset}`);
    }
  }
}

// Function to start a server process with retry logic
function startServer(script, name, color, options = {}) {
  console.log(`${color}Starting ${name} server...${colors.reset}`);
  
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'server', script);
    
    // Check if script exists
    if (!fs.existsSync(serverPath)) {
      console.error(`${colors.error}ERROR: Script ${serverPath} not found!${colors.reset}`);
      reject(new Error(`Script ${script} not found`));
      return;
    }
    
    // Start the server process
    const server = spawn('node', [serverPath], { 
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env }
    });
    
    let started = false;
    const startTimeout = setTimeout(() => {
      if (!started) {
        console.error(`${colors.error}[${name}] Server failed to start within timeout period${colors.reset}`);
        resolve({ server, success: false }); // Resolve anyway to allow other servers to start
      }
    }, options.timeout || 10000);
    
    server.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`${color}[${name}] ${output}${colors.reset}`);
      
      // Check for successful startup message
      if (output.includes('running on http://localhost') || 
          output.includes('server running') || 
          output.includes('started') ||
          output.includes('listening')) {
        started = true;
        clearTimeout(startTimeout);
        resolve({ server, success: true });
      }
    });
    
    server.stderr.on('data', (data) => {
      console.error(`${colors.error}[${name} ERROR] ${data.toString().trim()}${colors.reset}`);
    });
    
    server.on('close', (code) => {
      console.log(`${color}[${name}] Server process exited with code ${code}${colors.reset}`);
      
      // If the server crashed during startup, reject the promise
      if (!started) {
        clearTimeout(startTimeout);
        reject(new Error(`${name} server crashed during startup with code ${code}`));
        return;
      }
      
      // Restart server if it crashed
      if (code !== 0 && code !== null) {
        console.log(`${colors.info}[${name}] Restarting server in 5 seconds...${colors.reset}`);
        setTimeout(() => {
          startServer(script, name, color, options)
            .then(result => {
              console.log(`${color}[${name}] Server restarted${colors.reset}`);
            })
            .catch(error => {
              console.error(`${colors.error}[${name}] Failed to restart: ${error.message}${colors.reset}`);
            });
        }, 5000);
      }
    });
    
    server.on('error', (error) => {
      console.error(`${colors.error}[${name}] Failed to start server: ${error.message}${colors.reset}`);
      clearTimeout(startTimeout);
      reject(error);
    });
  });
}

// Main function to start all servers
async function startAllServers() {
  // Ensure directories and settings exist
  ensureDirectoriesExist();
  ensureSettingsExist();
  
  try {
    // Start highlight server first (must be up before the main server)
    console.log(`${colors.info}Starting highlight server...${colors.reset}`);
    const highlightResult = await startServer('highlight-server.js', 'Highlight Messages', colors.highlight, {
      timeout: 10000
    });
    
    // Wait a moment for highlight server to initialize
    console.log(`${colors.info}Waiting for highlight server to fully initialize...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start main server
    console.log(`${colors.info}Starting main server...${colors.reset}`);
    const mainResult = await startServer('server.js', 'Main Chat', colors.main, {
      timeout: 10000
    });
    
    // Start customization server
    console.log(`${colors.info}Starting customization dashboard...${colors.reset}`);
    const customizationResult = await startServer('customization-server.js', 'Customization Dashboard', colors.dashboard, {
      timeout: 10000
    });
    
    // Display URLs for access
    console.log(`
      ${colors.info}==========================================================
        Multi-Platform Chat Overlay (Direct API Integration)
      ==========================================================
      
        Add these URLs as Browser Sources in OBS:
      
        ${colors.main}Main Chat Overlay: http://localhost:3000/obs-view${colors.info}
        ${colors.highlight}Highlighted Messages: http://localhost:3001${colors.info}
        ${colors.dashboard}Customization Dashboard: http://localhost:3002${colors.info}
        ${colors.main}Streamer View: http://localhost:3000/streamer-view${colors.info}
      
        ${colors.dashboard}Configure Chat Sources: http://localhost:3002/#chat-sources-tab${colors.info}
      
        Press [Ctrl+C] to stop all servers
      ==========================================================${colors.reset}
      `);

    // Track all running servers
    const servers = [
      { name: 'Main Chat', server: mainResult.server, color: colors.main },
      { name: 'Highlight Messages', server: highlightResult.server, color: colors.highlight },
      { name: 'Customization Dashboard', server: customizationResult.server, color: colors.dashboard }
    ].filter(s => s.server);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n${colors.info}Shutting down all servers...${colors.reset}`);
      
      servers.forEach(s => {
        if (s.server) {
          try {
            s.server.kill();
            console.log(`${s.color}[${s.name}] Server stopped${colors.reset}`);
          } catch (err) {
            console.error(`${colors.error}Error stopping ${s.name} server: ${err.message}${colors.reset}`);
          }
        }
      });
      
      console.log(`${colors.info}All servers have been stopped.${colors.reset}`);
      process.exit(0);
    });
    
  } catch (error) {
    console.error(`${colors.error}Failed to start servers: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

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

// Start all servers
startAllServers().catch(error => {
  console.error(`${colors.error}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});