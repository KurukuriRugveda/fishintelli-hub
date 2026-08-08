'use strict';

const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DOCUMENT_TYPES = {
  STOCKING: 'Stocking Certificate',
  FEEDING: 'Feeding Log Sheet',
  WATER_QUALITY: 'Water Quality Log',
  HARVEST_LANDING: 'Landing Declaration',
  GRADING: 'Grading Certificate',
  COLD_STORAGE: 'Cold Storage Log',
  PROCESSING: 'Processing Batch Sheet',
  SALES: 'Sales Invoice'
};

/**
 * Extracts data from a document using Gemini.
 * @param {Buffer} fileBuffer - The document file buffer (PDF, image)
 * @param {string} mimeType - The mime type of the file
 * @param {string} docType - Expected document type
 */
async function processDocumentWithGemini(fileBuffer, mimeType, docType) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = `
    You are an expert AI extraction engine for Aquaculture documents.
    Extract the structured information from this ${docType} document.
    Return ONLY a valid JSON object matching the standard schema for ${docType}.
    Include a 'confidence' score between 0.0 and 1.0 for the overall extraction.
    Include an 'alerts' array with any strings describing anomalies, missing data, or out-of-range values.
    Do not wrap the JSON in markdown code blocks, just return raw JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: fileBuffer.toString('base64'), mimeType } }
          ]
        }
      ]
    });

    const text = response.text().trim();
    
    // Clean up potential markdown formatting
    let cleanText = text;
    if (cleanText.startsWith('\`\`\`json')) {
      cleanText = cleanText.substring(7);
      if (cleanText.endsWith('\`\`\`')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
    }
    
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('[AI] Extraction failed:', err);
    throw err;
  }
}

module.exports = {
  DOCUMENT_TYPES,
  processDocumentWithGemini
};
