import natural from 'natural';
import nlp from 'compromise';

const { TfIdf, WordTokenizer, PorterStemmer } = natural;

// Initialize tokenizer and stemmer
const tokenizer = new WordTokenizer();

// Stop words to filter out
const stopWords = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
  'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
  'while', 'of', 'at', 'by', 'for', 'with', 'through', 'during', 'before', 'after',
  'above', 'below', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'page', 'pdf', 'obj', 'endobj', 'stream', 'endstream',
  'xref', 'trailer', 'startxref', 'contents', 'resources', 'font', 'subtype', 'type',
  'length', 'filter', 'flatedecode', 'winansiencoding', 'encoding', 'basefont'
]);

// Technical skills and keywords dictionary
const technicalSkills = new Set([
  'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node', 'express',
  'mongodb', 'mysql', 'postgresql', 'sql', 'html', 'css', 'typescript', 'php',
  'laravel', 'django', 'flask', 'spring', 'hibernate', 'docker', 'kubernetes',
  'aws', 'azure', 'gcp', 'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'devops',
  'linux', 'ubuntu', 'centos', 'nginx', 'apache', 'redis', 'elasticsearch',
  'machine learning', 'artificial intelligence', 'data science', 'analytics',
  'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'matplotlib',
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'slack', 'teams',
  'communication', 'leadership', 'teamwork', 'problem solving', 'analytical',
  'project management', 'time management', 'critical thinking', 'creativity',
  'reactjs', 'nodejs', 'expressjs', 'frontend', 'backend', 'fullstack',
  'responsive', 'bootstrap', 'tailwind', 'sass', 'less', 'webpack', 'vite',
  'firebase', 'api', 'rest', 'graphql', 'json', 'ajax', 'jquery', 'testing',
  'jest', 'cypress', 'selenium', 'debugging', 'optimization', 'performance'
]);

// Clean and validate text content
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove PDF artifacts and metadata
  text = text.replace(/\/[A-Za-z]+\s*\d*\s*[A-Za-z]*\s*/g, ' '); // Remove PDF commands
  text = text.replace(/\d+\s+\d+\s+obj/g, ' '); // Remove object references
  text = text.replace(/endobj|stream|endstream/g, ' '); // Remove PDF keywords
  text = text.replace(/[^\w\s\-\.]/g, ' '); // Keep only alphanumeric, spaces, hyphens, dots
  text = text.replace(/\s+/g, ' '); // Normalize whitespace
  text = text.trim();
  
  return text;
}

// Check if text is meaningful (not just PDF metadata)
function isValidText(text) {
  if (!text || text.length < 10) return false;
  
  // Expanded list of common words that indicate real content
  const commonWords = [
    'experience', 'skills', 'education', 'work', 'project', 'develop', 'manage', 'team',
    'developer', 'engineer', 'software', 'system', 'data', 'analysis', 'management',
    'position', 'role', 'responsibilities', 'requirements', 'qualifications', 'candidate',
    'company', 'organization', 'department', 'technical', 'business', 'professional',
    'years', 'knowledge', 'ability', 'strong', 'excellent', 'required', 'preferred',
    'frontend', 'backend', 'fullstack', 'web', 'application', 'programming', 'coding',
    'javascript', 'react', 'node', 'html', 'css', 'database', 'api', 'framework'
  ];
  
  const hasCommonWords = commonWords.some(word => text.toLowerCase().includes(word));
  
  // Remove the overly strict meaningful character ratio check
  // Just check if we have common words that indicate real content
  return hasCommonWords;
}

// Clean and tokenize text
function preprocessText(text) {
  const cleanedText = cleanText(text);
  if (!isValidText(cleanedText)) return [];
  
  return tokenizer.tokenize(cleanedText.toLowerCase())
    .filter(token => 
      token.length > 2 && 
      !stopWords.has(token) && 
      /^[a-zA-Z]+$/.test(token)
    )
    .map(token => PorterStemmer.stem(token));
}

// Normalize keyword for better matching
function normalizeKeyword(keyword) {
  return keyword.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if a keyword exists in text with fuzzy matching
function keywordExistsInText(keyword, text) {
  const normalizedKeyword = normalizeKeyword(keyword);
  const normalizedText = normalizeKeyword(text);
  
  // Direct match
  if (normalizedText.includes(normalizedKeyword)) {
    return true;
  }
  
  // Check for partial matches and variations
  const keywordParts = normalizedKeyword.split(' ');
  const textWords = normalizedText.split(' ');
  
  // For multi-word keywords, check if all parts exist
  if (keywordParts.length > 1) {
    return keywordParts.every(part => 
      textWords.some(word => 
        word.includes(part) || part.includes(word) || 
        PorterStemmer.stem(word) === PorterStemmer.stem(part)
      )
    );
  }
  
  // For single words, check stemmed versions and partial matches
  return textWords.some(word => {
    if (word.includes(normalizedKeyword) || normalizedKeyword.includes(word)) {
      return true;
    }
    
    // Check stemmed versions
    const stemmedKeyword = PorterStemmer.stem(normalizedKeyword);
    const stemmedWord = PorterStemmer.stem(word);
    
    return stemmedKeyword === stemmedWord || 
           stemmedKeyword.includes(stemmedWord) || 
           stemmedWord.includes(stemmedKeyword);
  });
}

// Extract meaningful keywords using enhanced NLP
function extractKeywords(text, topN = 20) {
  const cleanedText = cleanText(text);
  
  if (!isValidText(cleanedText)) {
    console.warn('Text appears to be PDF metadata or corrupted. Using fallback extraction.');
    return extractFallbackKeywords(text, topN);
  }
  
  const doc = nlp(cleanedText);
  
  // Extract different types of terms with better filtering
  const skills = doc.match('#Skill').out('array');
  const technologies = doc.match('#Technology').out('array');
  const nouns = doc.nouns().out('array').filter(noun => noun.length > 2);
  const adjectives = doc.adjectives().out('array').filter(adj => adj.length > 3);
  
  // Add technical skills found in text
  const words = cleanedText.toLowerCase().split(/\s+/);
  const foundTechSkills = words.filter(word => technicalSkills.has(word));
  
  // Combine and clean keywords
  const allKeywords = [...skills, ...technologies, ...nouns, ...adjectives, ...foundTechSkills]
    .map(term => term.toLowerCase().trim())
    .filter(term => 
      term.length > 2 && 
      !stopWords.has(term) &&
      !/^\d+$/.test(term) && // No pure numbers
      !/^[^a-zA-Z]*$/.test(term) // Must contain letters
    );
  
  // Count frequency
  const keywordFreq = {};
  allKeywords.forEach(keyword => {
    keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
  });
  
  // Boost technical skills
  Object.keys(keywordFreq).forEach(keyword => {
    if (technicalSkills.has(keyword)) {
      keywordFreq[keyword] *= 2;
    }
  });
  
  // Sort by frequency and return top N
  return Object.entries(keywordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, topN)
    .map(([keyword, frequency]) => ({ keyword, frequency }));
}

// Fallback keyword extraction for corrupted text
function extractFallbackKeywords(text, topN = 20) {
  // Try to find any recognizable technical terms or skills
  const words = text.toLowerCase().split(/\s+/);
  const foundSkills = [];
  
  // Look for technical skills in the corrupted text
  technicalSkills.forEach(skill => {
    if (text.toLowerCase().includes(skill)) {
      foundSkills.push({ keyword: skill, frequency: 1 });
    }
  });
  
  // If no skills found, return generic programming terms
  if (foundSkills.length === 0) {
    return [
      { keyword: 'programming', frequency: 1 },
      { keyword: 'software', frequency: 1 },
      { keyword: 'development', frequency: 1 },
      { keyword: 'technical', frequency: 1 },
      { keyword: 'computer', frequency: 1 }
    ].slice(0, topN);
  }
  
  return foundSkills.slice(0, topN);
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

// Analyze resumes against job description
export async function analyzeResumes(jobDescription, resumes) {
  try {
    // Clean and validate job description
    const cleanedJobDesc = cleanText(jobDescription);
    if (!isValidText(cleanedJobDesc)) {
      // Try to extract keywords anyway for very short job descriptions
      console.warn('Job description is very short, proceeding with basic analysis');
    }
    
    // Extract keywords from job description
    const jobKeywords = extractKeywords(cleanedJobDesc);
    
    if (jobKeywords.length === 0) {
      // Create basic keywords from the text
      const words = cleanedJobDesc.toLowerCase().split(/\s+/);
      const basicKeywords = words
        .filter(word => word.length > 3 && !stopWords.has(word))
        .slice(0, 10)
        .map(word => ({ keyword: word, frequency: 1 }));
      
      if (basicKeywords.length === 0) {
        throw new Error('No meaningful keywords found in job description. Please check the file content.');
      }
      
      jobKeywords.push(...basicKeywords);
    }
    
    // Initialize TF-IDF
    const tfidf = new TfIdf();
    
    // Add job description to TF-IDF
    const jobTokens = preprocessText(cleanedJobDesc);
    tfidf.addDocument(jobTokens);
    
    // Process resumes
    const validResumes = [];
    const resumeTokens = [];
    
    resumes.forEach((resume, index) => {
      const cleanedContent = cleanText(resume.content);
      validResumes.push({ ...resume, content: cleanedContent });
      const tokens = preprocessText(cleanedContent);
      resumeTokens.push(tokens);
      tfidf.addDocument(tokens);
    });
    
    // Analyze each resume
    const results = validResumes.map((resume, index) => {
      const resumeIndex = index + 1; // +1 because job description is at index 0
      
      // Extract keywords from resume
      const resumeKeywords = extractKeywords(resume.content);
      
      // Calculate TF-IDF similarity
      const jobVector = [];
      const resumeVector = [];
      
      // Get all unique terms
      const allTerms = new Set();
      tfidf.listTerms(0).forEach(item => allTerms.add(item.term));
      tfidf.listTerms(resumeIndex).forEach(item => allTerms.add(item.term));
      
      // Build vectors
      allTerms.forEach(term => {
        jobVector.push(tfidf.tfidf(term, 0));
        resumeVector.push(tfidf.tfidf(term, resumeIndex));
      });
      
      // Calculate similarity score
      const similarityScore = cosineSimilarity(jobVector, resumeVector);
      
      // Find matching and missing keywords using improved matching
      const matchingKeywords = jobKeywords.filter(jk => 
        keywordExistsInText(jk.keyword, resume.content)
      );
      
      const missingKeywords = jobKeywords.filter(jk => 
        !keywordExistsInText(jk.keyword, resume.content)
      ).slice(0, 10); // Top 10 missing keywords
      
      // Calculate match percentage
      const matchPercentage = jobKeywords.length > 0 
        ? (matchingKeywords.length / jobKeywords.length) * 100 
        : 0;
      
      // Generate feedback
      const feedback = generateFeedback(matchingKeywords, missingKeywords, similarityScore);
      
      return {
        filename: resume.filename,
        score: Math.round(Math.max(similarityScore * 100, matchPercentage)),
        matchPercentage: Math.round(matchPercentage),
        matchingKeywords: matchingKeywords.slice(0, 10),
        missingKeywords,
        resumeKeywords: resumeKeywords.slice(0, 15),
        feedback
      };
    });
    
    // Sort by score (highest first)
    const rankedResumes = results.sort((a, b) => b.score - a.score);
    
    return {
      jobKeywords,
      rankedResumes,
      summary: {
        totalResumes: resumes.length,
        averageScore: Math.round(rankedResumes.reduce((sum, r) => sum + r.score, 0) / rankedResumes.length),
        topScore: rankedResumes[0]?.score || 0,
        topCandidate: rankedResumes[0]?.filename || 'None'
      }
    };
    
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('Failed to analyze resumes: ' + error.message);
  }
}

// Generate feedback based on analysis
function generateFeedback(matchingKeywords, missingKeywords, score) {
  const feedback = [];
  
  if (score > 0.7) {
    feedback.push("Excellent match! This candidate's resume aligns very well with the job requirements.");
  } else if (score > 0.5) {
    feedback.push("Good match. This candidate shows strong alignment with several key requirements.");
  } else if (score > 0.3) {
    feedback.push("Moderate match. Some relevant skills present, but significant gaps remain.");
  } else {
    feedback.push("Limited match. This candidate may need significant upskilling or may not be suitable for this role.");
  }
  
  if (matchingKeywords.length > 0) {
    feedback.push(`Strong areas: ${matchingKeywords.slice(0, 5).map(k => k.keyword).join(', ')}`);
  }
  
  if (missingKeywords.length > 0) {
    feedback.push(`Areas for improvement: ${missingKeywords.slice(0, 5).map(k => k.keyword).join(', ')}`);
  }
  
  return feedback;
}