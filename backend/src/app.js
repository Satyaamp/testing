const express = require('express');
const cors = require('cors');
const path = require('path');

const Expense = require('./models/expense.model');
const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../../frontend")));



// Storage stats cache for MongoDB Atlas M0 (TTL: 20 seconds to prevent slow consecutive WAN roundtrips)
let cachedStorageStats = null;
let lastStorageStatsFetch = 0;
const STATS_CACHE_TTL = 20000;
const schemaMetadata = require('./utils/schemaMetadata');

app.get('/health', async (req, res) => {
  const isHtml = req.headers.accept && req.headers.accept.includes('text/html') && req.query.format !== 'json';

  if (isHtml) {
    return res.sendFile(path.join(__dirname, '../../frontend/health.html'));
  }

  const mongoose = require('mongoose');
  const os = require('os');
  let pkg = {};
  try {
    pkg = require('../package.json');
  } catch (e) {
    pkg = {};
  }

  const uptimeSec = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  const uptimeFormatted = `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;

  const mem = process.memoryUsage();
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  // MongoDB Atlas M0 Free Tier Storage Diagnostics (512 MB storage quota)
  let storageStats = {
    tier: "MongoDB Atlas M0 Free Tier",
    limitMB: 512,
    usedMB: "0.00",
    freeMB: "512.00",
    percentUsed: "0.00",
    dataSizeMB: "0.00",
    storageSizeMB: "0.00",
    indexSizeMB: "0.00",
    collections: 0,
    documents: 0,
    indexes: 0,
    collectionsBreakdown: []
  };

  const now = Date.now();
  if (cachedStorageStats && (now - lastStorageStatsFetch < STATS_CACHE_TTL)) {
    storageStats = cachedStorageStats;
  } else if (dbState === 1 && mongoose.connection.db) {
    try {
      const stats = await mongoose.connection.db.stats();
      const storageSize = stats.storageSize || 0;
      const indexSize = stats.indexSize || 0;
      const dataSize = stats.dataSize || 0;
      const totalUsedBytes = storageSize + indexSize;
      const usedMB = (totalUsedBytes / (1024 * 1024)).toFixed(2);
      const limitMB = 512;
      const freeMB = Math.max(0, limitMB - parseFloat(usedMB)).toFixed(2);
      const percentUsed = ((parseFloat(usedMB) / limitMB) * 100).toFixed(2);

      // Collection-level statistics breakdown matching MongoDB Atlas view
      const colls = await mongoose.connection.db.listCollections().toArray();
      const collectionsList = await Promise.all(colls.map(async (c) => {
        try {
          const s = await mongoose.connection.db.command({ collStats: c.name });
          return {
            name: c.name,
            documents: s.count || 0,
            storageSize: s.storageSize || 0,
            dataSize: s.size || 0,
            avgObjSize: Math.round(s.avgObjSize || 0),
            indexes: s.nindexes || 0,
            totalIndexSize: s.totalIndexSize || 0
          };
        } catch (err) {
          return {
            name: c.name,
            documents: 0,
            storageSize: 0,
            dataSize: 0,
            avgObjSize: 0,
            indexes: 0,
            totalIndexSize: 0
          };
        }
      }));
      collectionsList.sort((a, b) => b.documents - a.documents);

      storageStats = {
        tier: "MongoDB Atlas M0 Free Tier",
        limitMB,
        usedMB,
        freeMB,
        percentUsed,
        dataSizeMB: (dataSize / (1024 * 1024)).toFixed(2),
        storageSizeMB: (storageSize / (1024 * 1024)).toFixed(2),
        indexSizeMB: (indexSize / (1024 * 1024)).toFixed(2),
        collections: stats.collections || collectionsList.length || 0,
        documents: stats.objects || 0,
        indexes: stats.indexes || 0,
        collectionsBreakdown: collectionsList
      };

      cachedStorageStats = storageStats;
      lastStorageStatsFetch = now;
    } catch (e) {
      console.warn("Could not fetch db.stats():", e.message);
      if (cachedStorageStats) {
        storageStats = cachedStorageStats;
      }
    }
  } else if (cachedStorageStats) {
    storageStats = cachedStorageStats;
  }

  const healthData = {
    status: dbState === 1 ? 'OK' : 'DEGRADED',
    service: 'DhanRekha API',
    appVersion: pkg.version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSec,
      formatted: uptimeFormatted
    },
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      readyState: dbState,
      host: mongoose.connection.host || 'localhost',
      name: mongoose.connection.name || 'expensetracker',
      storage: storageStats
    },
    schemas: schemaMetadata,
    system: {
      nodeVersion: process.version,
      platform: `${os.platform()} (${os.arch()})`,
      cpuCount: os.cpus().length,
      pid: process.pid,
      memory: {
        rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
        heapPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100)
      },
      runtimes: {
        node: process.versions.node,
        v8: process.versions.v8,
        openssl: process.versions.openssl,
        mongoose: mongoose.version,
        express: pkg.dependencies?.express?.replace('^', '') || '4.19.2'
      }
    },
    modules: {
      backend: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      frontend: {
        "chart.js": "4.4.1 (Data Visualization)",
        "jspdf": "2.5.1 (PDF Generation)",
        "jspdf-autotable": "3.5.31 (PDF Table Rendering)",
        "xlsx-js-style": "1.2.0 (Formatted Excel Reports)",
        "service-worker": "dhanrekha-v97 (Progressive Web App)"
      }
    },
    cron: {
      reminderScheduler: 'active',
      schedule: '0 21 * * * (Daily at 9:00 PM IST)'
    }
  };

  res.status(200).json(healthData);
});

// Fetch Categories dynamically (Backward-compatible fallback & User-aware)
const categoryService = require('./services/category.service');
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;
    }
  } catch (e) { /* ignore error for optional auth */ }
  next();
};

app.get('/api/expenses/categories', optionalAuth, async (req, res) => {
  try {
    if (req.user && (req.user.id || req.user._id)) {
      const names = await categoryService.getUserCategoryNames(req.user.id || req.user._id);
      return res.status(200).json({ data: names });
    }
    const defaultCategories = require('./models/category.model').DEFAULT_SYSTEM_CATEGORIES.map(c => c.name);
    res.status(200).json({ data: defaultCategories });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/patches', require('./routes/patch.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/income', require('./routes/income.routes'));
app.use('/api/whatsapp', require('./routes/whatsapp.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api', require('./routes/password.routes'));

// Initialize Reminder Cron Service
const notificationService = require('./services/notification.service');
notificationService.initReminderCron();

app.use(require('./middleware/error.middleware'));

module.exports = app;