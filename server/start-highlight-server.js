// Standalone script to start the highlight server
// This ensures the server is properly initialized before being imported by the main server

const highlightServer = require('./highlight-server');

// Start the highlight server
highlightServer.startServer();

console.log('Highlight server started and ready for connections');