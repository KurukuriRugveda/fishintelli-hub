'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getUserByUsername, createUser, logAudit } = require('./db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev-only';
const JWT_EXPIRES_IN = '1d';

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Middleware to verify roles
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
    }
    next();
  };
}

// Auth Routes

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, facilityId: user.facility_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logAudit({
      id: uuidv4(),
      userId: user.id,
      action: 'LOGIN',
      resource: 'AUTH',
      details: { timestamp: new Date().toISOString() }
    });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// Seed default users for development if they don't exist
async function seedDefaultUsers() {
  const defaultUsers = [
    { username: 'admin', role: 'Cooperative Manager' },
    { username: 'farmer', role: 'Fish Farmer' },
    { username: 'inspector', role: 'Quality Inspector' }
  ];

  for (const u of defaultUsers) {
    if (!getUserByUsername(u.username)) {
      const hash = await bcrypt.hash('password123', 10);
      createUser({
        id: uuidv4(),
        username: u.username,
        passwordHash: hash,
        role: u.role,
        facilityId: 'FAC-001'
      });
      console.log(`[AUTH] Seeded user ${u.username}`);
    }
  }
}

// Immediately seed users in dev mode
seedDefaultUsers().catch(err => console.error('[AUTH] Failed to seed users:', err));

module.exports = {
  router,
  authenticateToken,
  requireRole,
};
