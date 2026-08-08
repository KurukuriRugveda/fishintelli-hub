'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  DOCUMENT_TYPES,
  processDocument
} = require('./mock_ai_engine');

const {
  processDocumentWithGemini
} = require('./ai_engine');

const {
  db,
  getAllDocuments,
  getDocumentById,
  insertDocument,
  updateDocumentAction,
  resetDocuments,
  getAnalytics
} = require('./db');

const {
  router: authRouter,
  authenticateToken
} = require('./auth');


// ============================================================
// APP SETUP
// ============================================================

const app = express();

const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || 'development';


// ============================================================
// SECURITY / MIDDLEWARE
// ============================================================

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(compression());

app.use(
  morgan(
    ENV === 'production'
      ? 'combined'
      : 'dev'
  )
);


// ============================================================
// CORS
// ============================================================

// IMPORTANT:
// Do NOT put Markdown links here.
// Use plain URLs only.

const allowedOrigins = [
  'https://fishintelli-hub.vercel.app',
  'https://fisheries-intelligent-hub.vercel.app',
  'https://auqa-intelligent-hub-frontend.vercel.app',

  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];

// Add Render environment variable origins if provided
if (process.env.CORS_ORIGINS) {
  const extraOrigins = process.env.CORS_ORIGINS
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  allowedOrigins.push(...extraOrigins);
}

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

console.log('[CORS] Allowed origins:');
console.log(uniqueOrigins);


app.use(
  cors({
    origin: function (origin, callback) {

      // Allow Postman, curl, server-to-server etc.
      if (!origin) {
        return callback(null, true);
      }

      if (uniqueOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        `[CORS] Blocked origin: ${origin}`
      );

      return callback(
        new Error(
          `CORS policy: origin '${origin}' not allowed.`
        )
      );
    },

    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ],

    credentials: false,

    optionsSuccessStatus: 204
  })
);


// Explicit OPTIONS handling
app.options('*', cors());


// JSON body parser
app.use(
  express.json({
    limit: '2mb'
  })
);


// ============================================================
// RATE LIMITING
// ============================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 200,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error: 'Too many requests. Please try again later.'
  }
});

app.use('/api', apiLimiter);


// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/', (req, res) => {

  res.status(200).json({
    status: 'ok',

    message: 'AquaIntelligent Hub backend is running.',

    environment: ENV,

    timestamp: new Date().toISOString()
  });

});


// Dedicated health endpoint
app.get('/health', (req, res) => {

  res.status(200).json({
    status: 'healthy',

    service: 'AquaIntelligent Hub API',

    environment: ENV,

    timestamp: new Date().toISOString()
  });

});


// ============================================================
// AUTH ROUTES
// ============================================================

// Frontend should use:
// POST /api/auth/login

app.use('/api/auth', authRouter);


// ============================================================
// DOCUMENT ROUTES
// ============================================================


// ------------------------------------------------------------
// GET /api/documents
// ------------------------------------------------------------

app.get(
  '/api/documents',
  authenticateToken,
  (req, res, next) => {

    try {

      const documents = getAllDocuments();

      return res.status(200).json(documents);

    } catch (error) {

      next(error);

    }

  }
);


// ------------------------------------------------------------
// POST /api/documents/upload
// Mock upload
// ------------------------------------------------------------

app.post(
  '/api/documents/upload',
  authenticateToken,
  (req, res, next) => {

    try {

      const {
        templateId,
        uploader,
        customName
      } = req.body;


      if (!templateId) {

        return res.status(400).json({
          error: 'templateId is required.'
        });

      }


      // Simulated processing
      setTimeout(() => {

        try {

          const document = processDocument({
            templateId,
            uploader:
              uploader ||
              req.user?.username ||
              'Unknown User',

            customName
          });


          insertDocument(document);


          return res.status(201).json(document);

        } catch (error) {

          next(error);

        }

      }, 1200);

    } catch (error) {

      next(error);

    }

  }
);


// ============================================================
// FILE UPLOAD CONFIGURATION
// ============================================================

const uploadDir = path.join(
  __dirname,
  'uploads'
);


// Create uploads folder
if (!fs.existsSync(uploadDir)) {

  fs.mkdirSync(
    uploadDir,
    {
      recursive: true
    }
  );

}


const storage = multer.diskStorage({

  destination: function (
    req,
    file,
    cb
  ) {

    cb(
      null,
      uploadDir
    );

  },


  filename: function (
    req,
    file,
    cb
  ) {

    const uniqueSuffix =
      Date.now() +
      '-' +
      Math.round(
        Math.random() * 1E9
      );


    cb(
      null,
      uniqueSuffix +
      path.extname(
        file.originalname
      )
    );

  }

});


const upload = multer({

  storage,

  limits: {
    fileSize:
      10 * 1024 * 1024
  }

});


// ============================================================
// REAL DOCUMENT UPLOAD + GEMINI
// ============================================================

app.post(
  '/api/documents/real-upload',

  authenticateToken,

  upload.single('file'),

  async (req, res, next) => {

    try {

      const file = req.file;

      const {
        docType,
        facility
      } = req.body;


      if (!file) {

        return res.status(400).json({
          error: 'No file uploaded.'
        });

      }


      // Read uploaded file
      const fileBuffer =
        fs.readFileSync(
          file.path
        );


      let aiResult;


      try {

        aiResult =
          await processDocumentWithGemini(
            fileBuffer,
            file.mimetype,
            docType
          );

      } catch (aiError) {

        console.error(
          '[AI] Gemini error:',
          aiError
        );


        // Delete temporary file
        try {

          fs.unlinkSync(
            file.path
          );

        } catch (_) {}


        return res.status(500).json({

          error:
            'AI extraction failed.',

          details:
            ENV !== 'production'
              ? aiError.message
              : undefined

        });

      }


      // Delete uploaded file after processing
      try {

        fs.unlinkSync(
          file.path
        );

      } catch (_) {}


      // ======================================================
      // BUILD DOCUMENT
      // ======================================================

      const confidence =
        Number(
          aiResult?.confidence ?? 0.9
        );


      const alerts =
        Array.isArray(
          aiResult?.alerts
        )
          ? aiResult.alerts
          : [];


      const docStatus =
        alerts.length > 0 ||
        confidence < 0.85
          ? 'Flagged'
          : 'Auto-Approved';


      const docId =
        'doc-' +
        uuidv4()
          .substring(0, 8);


      const newDocument = {

        id: docId,

        fileName:
          file.originalname,

        type:
          docType ||
          DOCUMENT_TYPES.WATER_QUALITY,

        facility:
          facility ||
          req.user?.facilityId ||
          'Unknown Facility',

        uploader:
          req.user?.username ||
          'Unknown User',

        uploadTime:
          new Date().toISOString(),

        content:
          aiResult?.content ||
          aiResult,

        alerts,

        status:
          docStatus,

        extractionConfidence:
          confidence,

        aiRecommendation:
          docStatus === 'Flagged'

            ? 'Requires human review due to low confidence or alerts.'

            : 'High confidence, auto-approved.',

        reviewerNotes:
          null

      };


      insertDocument(
        newDocument
      );


      return res.status(201).json(
        newDocument
      );


    } catch (error) {

      next(error);

    }

  }
);


// ============================================================
// RESET DOCUMENTS
// ============================================================

app.post(
  '/api/documents/reset',

  authenticateToken,

  (req, res, next) => {

    try {

      const documents =
        resetDocuments();


      return res.status(200).json({

        message:
          'Database reset to initial state.',

        count:
          documents.length

      });

    } catch (error) {

      next(error);

    }

  }
);


// ============================================================
// DOCUMENT ACTION
// ============================================================

// POST /api/documents/:id/action

app.post(
  '/api/documents/:id/action',

  authenticateToken,

  (req, res, next) => {

    try {

      const {
        id
      } = req.params;


      const {
        action,
        reviewerNotes
      } = req.body;


      const userRole =
        req.user?.role ||
        'Reviewer';


      if (!action) {

        return res.status(400).json({

          error:
            'action is required.'

        });

      }


      const existing =
        getDocumentById(id);


      if (!existing) {

        return res.status(404).json({

          error:
            'Document not found.'

        });

      }


      const statusMap = {

        APPROVE:
          'Approved',

        REJECT:
          'Rejected',

        FLAG:
          'Flagged'

      };


      const newStatus =
        statusMap[action];


      if (!newStatus) {

        return res.status(400).json({

          error:
            `Unknown action '${action}'. Use APPROVE, REJECT, or FLAG.`

        });

      }


      const updated =
        updateDocumentAction({

          id,

          status:
            newStatus,

          decisionBy:
            `${userRole} (Reviewer)`,

          decisionTime:
            new Date().toISOString(),

          reviewerNotes:
            reviewerNotes ||
            `Action: ${action} applied.`

        });


      return res.status(200).json({

        message:
          'Document action recorded.',

        document:
          updated

      });


    } catch (error) {

      next(error);

    }

  }
);


// ============================================================
// ANALYTICS
// ============================================================

// GET /api/analytics

app.get(
  '/api/analytics',

  authenticateToken,

  (req, res, next) => {

    try {

      const analytics =
        getAnalytics(
          DOCUMENT_TYPES
        );


      return res.status(200).json(
        analytics
      );

    } catch (error) {

      next(error);

    }

  }
);


// ============================================================
// 404 HANDLER
// ============================================================

app.use(
  (req, res) => {

    return res.status(404).json({

      error:
        'Route not found.',

      method:
        req.method,

      path:
        req.originalUrl

    });

  }
);


// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      '[ERROR]',
      err.message
    );


    // CORS error
    if (
      err.message &&
      err.message.includes(
        'CORS policy'
      )
    ) {

      return res.status(500).json({

        error:
          err.message

      });

    }


    const status =
      err.status ||
      500;


    return res.status(status).json({

      error:
        err.message ||
        'Internal server error.',

      ...(ENV !== 'production' && {

        stack:
          err.stack

      })

    });

  }
);


// ============================================================
// START SERVER
// ============================================================

const server =
  app.listen(
    PORT,
    '0.0.0.0',
    () => {

      console.log(
        '================================================'
      );

      console.log(
        'AquaIntelligent Hub Backend'
      );

      console.log(
        `Environment: ${ENV}`
      );

      console.log(
        `Port: ${PORT}`
      );

      console.log(
        `Server running on port ${PORT}`
      );

      console.log(
        '================================================'
      );

    }
  );


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function gracefulShutdown(
  signal
) {

  console.log(
    `[SERVER] ${signal} received.`
  );


  server.close(() => {

    console.log(
      '[SERVER] HTTP server closed.'
    );


    try {

      if (db) {

        db.close();

        console.log(
          '[DB] SQLite connection closed.'
        );

      }

    } catch (error) {

      console.error(
        '[DB] Close error:',
        error.message
      );

    }


    process.exit(0);

  });


  // Force exit
  setTimeout(() => {

    console.error(
      '[SERVER] Forced exit after timeout.'
    );

    process.exit(1);

  }, 10000);

}


process.on(
  'SIGTERM',
  () =>
    gracefulShutdown('SIGTERM')
);

process.on(
  'SIGINT',
  () =>
    gracefulShutdown('SIGINT')
);
