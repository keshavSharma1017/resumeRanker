import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { analyzeResumes } from './nlp/analyzer.js';
import { generatePDFReport } from './utils/pdfGenerator.js';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper function to extract text from different file types
async function extractTextFromFile(filePath, originalName) {
  try {
    const ext = path.extname(originalName).toLowerCase();
    
    if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf8');
    } else if (ext === '.pdf') {
      // For PDF files, we'll read as text and warn about limitations
      console.warn(`PDF parsing is basic. For better results, please convert to TXT format: ${originalName}`);
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch (error) {
        throw new Error(`Cannot read PDF file as text. Please convert ${originalName} to TXT format.`);
      }
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (ext === '.doc') {
      // For .doc files, we'll try to read as text but warn about limitations
      console.warn(`DOC file parsing is limited. Consider converting to DOCX or TXT for better results: ${originalName}`);
      return fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    console.error(`Error reading file ${originalName}:`, error);
    throw new Error(`Failed to read file: ${originalName}. ${error.message}`);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT, PDF, DOC, and DOCX files are allowed.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// In-memory storage for analysis results (in production, use a database)
const analysisResults = new Map();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Upload endpoint
app.post('/api/upload', upload.fields([
  { name: 'jobDescription', maxCount: 1 },
  { name: 'resumes', maxCount: 10 }
]), async (req, res) => {
  try {
    const { jobDescription, resumes } = req.files;
    
    if (!jobDescription || !resumes) {
      return res.status(400).json({ 
        error: 'Both job description and at least one resume file are required' 
      });
    }

    // Extract job description content with better error handling
    let jobDescContent;
    try {
      jobDescContent = await extractTextFromFile(jobDescription[0].path, jobDescription[0].originalname);
      if (!jobDescContent || jobDescContent.trim().length < 10) {
        throw new Error('Job description file appears to be empty or too short');
      }
    } catch (error) {
      return res.status(400).json({ 
        error: `Failed to process job description: ${error.message}` 
      });
    }

    // Extract resume contents with better error handling
    const resumeContents = [];
    for (const resume of resumes) {
      try {
        const content = await extractTextFromFile(resume.path, resume.originalname);
        resumeContents.push({
          filename: resume.originalname,
          content: content,
          path: resume.path
        });
      } catch (error) {
        console.warn(`Failed to process resume ${resume.originalname}:`, error);
        // Continue with other resumes
        resumeContents.push({
          filename: resume.originalname,
          content: `Error reading file: ${resume.originalname}`,
          path: resume.path
        });
      }
    }

    if (resumeContents.length === 0) {
      return res.status(400).json({ 
        error: 'No valid resume files could be processed' 
      });
    }

    // Analyze resumes
    const analysis = await analyzeResumes(jobDescContent, resumeContents);
    
    // Store results with unique ID
    const analysisId = uuidv4();
    analysisResults.set(analysisId, {
      ...analysis,
      timestamp: new Date().toISOString(),
      jobDescription: jobDescContent
    });

    res.json({
      analysisId,
      results: analysis
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process files. Please ensure files contain readable text content.' 
    });
  }
});

// Get analysis results
app.get('/api/analysis/:id', (req, res) => {
  const { id } = req.params;
  const results = analysisResults.get(id);
  
  if (!results) {
    return res.status(404).json({ error: 'Analysis not found' });
  }
  
  res.json(results);
});

// Generate PDF report
app.get('/api/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const results = analysisResults.get(id);
    
    if (!results) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const pdfBuffer = await generatePDFReport(results);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume-analysis-${id}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// Get all analysis history
app.get('/api/history', (req, res) => {
  const history = Array.from(analysisResults.entries()).map(([id, data]) => ({
    id,
    timestamp: data.timestamp,
    resumeCount: data.rankedResumes.length,
    topScore: Math.max(...data.rankedResumes.map(r => r.score))
  }));
  
  res.json(history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
  }
  res.status(500).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`ResumeRanker server running on http://localhost:${PORT}`);
});