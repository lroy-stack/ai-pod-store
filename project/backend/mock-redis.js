#!/usr/bin/env node

/**
 * Mock Redis Server for Development
 * Implements basic Redis protocol to respond to PING commands
 * This allows health checks to pass during development when Redis is not available
 */

import net from 'net';

const PORT = 6379;
const HOST = '127.0.0.1';

const server = net.createServer((socket) => {
  console.log('Client connected');

  socket.on('data', (data) => {
    const command = data.toString().trim();
    console.log('Received:', command);

    // Handle Redis protocol for PING command
    // Redis uses RESP (Redis Serialization Protocol)
    if (command.includes('PING') || command.includes('ping')) {
      // RESP Simple String: +PONG\r\n
      socket.write('+PONG\r\n');
    } else if (command.includes('QUIT') || command.includes('quit')) {
      socket.write('+OK\r\n');
      socket.end();
    } else {
      // Generic OK response for other commands
      socket.write('+OK\r\n');
    }
  });

  socket.on('end', () => {
    console.log('Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Mock Redis server listening on ${HOST}:${PORT}`);
  console.log('This is a development mock - use real Redis in production!');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Redis may already be running.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down mock Redis server...');
  server.close(() => {
    console.log('Mock Redis server closed');
    process.exit(0);
  });
});
