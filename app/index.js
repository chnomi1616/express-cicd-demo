const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Root route - just so visiting the server in a browser shows something
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the CI/CD demo app' });
});

// Health check endpoint - Docker/EC2/monitoring tools will ping this
// to know if the app is alive and healthy.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Only start the server if this file is run directly (not imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`App running on port ${PORT}`);
  });
}

module.exports = app;
