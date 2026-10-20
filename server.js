require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const inviteeRoutes = require('./routes/inviteeRoutes');
const rsvpRoutes = require('./routes/rsvpRoutes');
const materialRoutes = require('./routes/materialRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'UACC EventHub Backend',
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Mount API routes with both /api prefix and direct paths to support frontend client configurations
const routeModules = [
  { path: '/auth', router: authRoutes },
  { path: '/events', router: eventRoutes },
  { path: '/invitees', router: inviteeRoutes },
  { path: '/invite', router: rsvpRoutes },
  { path: '/materials', router: materialRoutes },
];

routeModules.forEach(({ path, router }) => {
  app.use(`/api${path}`, router);
  app.use(path, router);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File is too large. Maximum size is 10MB.',
    });
  }

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 UACC EventHub Backend running on port ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
    console.log(`⚡ Healthcheck: http://localhost:${PORT}/health`);
    console.log(`===============================================`);
  });
}

module.exports = app;
