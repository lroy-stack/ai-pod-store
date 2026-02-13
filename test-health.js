const http = require('http');

const req = http.get('http://localhost:3001/api/health', { timeout: 8000 }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data);
    process.exit(0);
  });
});

req.on('error', err => {
  console.error('Error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Request timeout after 8 seconds');
  req.destroy();
  process.exit(1);
});
