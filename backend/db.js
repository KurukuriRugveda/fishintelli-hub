'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { MOCK_TEMPLATES, processDocument } = require('./mock_ai_engine');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aqua_hub';

// ─── Schemas ─────────────────────────────────────────────────────────────────
const documentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  fileName: { type: String, required: true },
  type: { type: String, required: true },
  facility: { type: String, required: true },
  uploader: { type: String, required: true },
  uploadTime: { type: String, required: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  alerts: { type: mongoose.Schema.Types.Mixed, required: true, default: [] },
  status: { type: String, required: true, default: 'Flagged' },
  extractionConfidence: { type: Number, required: true, default: 0 },
  aiRecommendation: { type: String },
  decisionBy: { type: String },
  decisionTime: { type: String },
  reviewerNotes: { type: String }
});

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, required: true },
  facility_id: { type: String }
});

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: String, required: true }
});

const Document = mongoose.model('Document', documentSchema);
const User = mongoose.model('User', userSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// ─── Connection & Seeding ────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log(`[DB] Connected to MongoDB at ${MONGODB_URI}`);
    await seedIfEmpty();
  })
  .catch(err => console.error('[DB] MongoDB connection error:', err));

async function seedIfEmpty() {
  const count = await Document.countDocuments();
  if (count > 0) {
    console.log(`[DB] Existing data found (${count} records). Skipping seed.`);
    return;
  }

  const seedDocs = MOCK_TEMPLATES.map(tpl => {
    const doc = processDocument({
      templateId: tpl.id,
      uploader: tpl.uploader,
      customName: tpl.fileName,
    });

    if (tpl.id.endsWith('001')) {
      doc.status = 'Approved';
      doc.decisionBy = 'Cooperative Manager (Sarah Jenkins)';
      doc.decisionTime = new Date(Date.now() - 3_600_000 * 4).toISOString();
      doc.reviewerNotes = 'Verified. Operational limits normal, data matches baseline.';
    }
    return doc;
  });

  await Document.insertMany(seedDocs);
  console.log(`[DB] Seeded ${seedDocs.length} records.`);
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function getAllDocuments() {
  return await Document.find().sort({ uploadTime: -1 }).lean();
}

async function getDocumentById(id) {
  return await Document.findOne({ id }).lean();
}

async function insertDocument(doc) {
  return await Document.create(doc);
}

async function updateDocumentAction({ id, status, decisionBy, decisionTime, reviewerNotes }) {
  return await Document.findOneAndUpdate(
    { id },
    { status, decisionBy, decisionTime, reviewerNotes },
    { new: true }
  ).lean();
}

async function resetDocuments() {
  await Document.deleteMany({});
  await seedIfEmpty();
  return await getAllDocuments();
}

async function getAnalytics(DOCUMENT_TYPES) {
  const docs = await getAllDocuments();

  const totalIngested = docs.length;
  const approvedCount = docs.filter(d => d.status === 'Approved' || d.status === 'Auto-Approved').length;
  const flaggedCount = docs.filter(d => d.status === 'Flagged').length;
  const rejectedCount = docs.filter(d => d.status === 'Rejected').length;
  const totalConfidence = docs.reduce((s, d) => s + d.extractionConfidence, 0);
  const avgConfidence = totalIngested > 0
    ? parseFloat((totalConfidence / totalIngested).toFixed(1))
    : 0;
  const flaggedRate = totalIngested > 0
    ? parseFloat(((flaggedCount / totalIngested) * 100).toFixed(1))
    : 0;

  const landingDocs = docs.filter(d => d.type === DOCUMENT_TYPES.HARVEST_LANDING);
  const totalHarvestedKg = landingDocs.reduce((s, d) => s + (d.content.weightKg || 0), 0);

  const typeCounts = {};
  docs.forEach(d => {
    typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
  });

  const timelineData = docs.slice(0, 10).map(d => ({
    time: d.uploadTime,
    type: d.type,
    status: d.status,
    confidence: d.extractionConfidence,
  }));

  const waterQualityData = docs
    .filter(d => d.type === DOCUMENT_TYPES.WATER_QUALITY)
    .map(d => ({
      time: d.uploadTime,
      pH: d.content.pH,
      do: d.content.dissolvedOxygenMgL,
      temp: d.content.waterTempC,
    }));

  const coldStorageData = docs
    .filter(d => d.type === DOCUMENT_TYPES.COLD_STORAGE)
    .map(d => ({
      time: d.uploadTime,
      avgTemp: d.content.averageTempC,
      maxTemp: d.content.maxTempC,
    }));

  return {
    totalIngested,
    approvedCount,
    flaggedCount,
    rejectedCount,
    avgConfidence,
    flaggedRate,
    totalHarvestedKg,
    typeCounts,
    timelineData,
    waterQualityData,
    coldStorageData,
  };
}

async function createUser({ id, username, passwordHash, role, facilityId }) {
  return await User.create({
    id,
    username,
    password_hash: passwordHash,
    role,
    facility_id: facilityId
  });
}

async function getUserByUsername(username) {
  return await User.findOne({ username }).lean();
}

async function getUserById(id) {
  return await User.findOne({ id }).lean();
}

async function logAudit({ id, userId, action, resource, details }) {
  return await AuditLog.create({
    id,
    userId,
    action,
    resource,
    details,
    timestamp: new Date().toISOString()
  });
}

// Expose mongoose connection for graceful shutdown
module.exports = {
  db: mongoose.connection,
  getAllDocuments,
  getDocumentById,
  insertDocument,
  updateDocumentAction,
  resetDocuments,
  getAnalytics,
  createUser,
  getUserByUsername,
  getUserById,
  logAudit,
};
