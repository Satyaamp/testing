require('dotenv').config();
const path = require('path');
const express = require('express');

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;
const FRONTEND_PATH = path.join(__dirname, '../frontend');

// Serve Static Files
app.use(express.static(FRONTEND_PATH));

// Routes
const routes = [
  'index',
  'login',
  'signup',
  'dashboard',
  'monthly',
  'yearly',
  'analytics',
  'profile',
  'forgot-password',
  'reset-password',
  'sitemap'
];

routes.forEach(route => {
  const routePath = route === 'index' ? '/' : `/${route}`;
  const fileName = route === 'index' ? 'index.html' : `${route}.html`;

  app.get(routePath, (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, fileName));
  });
});

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(FRONTEND_PATH, '404.html'));
});

// Start Server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });