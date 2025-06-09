class ResumeRanker {
    constructor() {
        this.currentAnalysisId = null;
        this.initializeEventListeners();
        this.loadHistory();
    }

    initializeEventListeners() {
        // Upload form
        const uploadForm = document.getElementById('uploadForm');
        uploadForm.addEventListener('submit', this.handleUpload.bind(this));

        // Download report button
        const downloadBtn = document.getElementById('downloadReportBtn');
        downloadBtn.addEventListener('click', this.downloadReport.bind(this));

        // Modal close
        const modal = document.getElementById('errorModal');
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    async handleUpload(event) {
        event.preventDefault();
        
        const uploadBtn = document.getElementById('uploadBtn');
        const formData = new FormData(event.target);
        
        // Validate files
        const jobDesc = formData.get('jobDescription');
        const resumes = formData.getAll('resumes');
        
        if (!jobDesc || resumes.length === 0) {
            this.showError('Please select both a job description and at least one resume file.');
            return;
        }
        
        if (resumes.length > 10) {
            this.showError('Maximum 10 resume files allowed.');
            return;
        }

        // Show loading state
        uploadBtn.classList.add('loading');
        uploadBtn.disabled = true;

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            const data = await response.json();
            this.currentAnalysisId = data.analysisId;
            this.displayResults(data.results);
            this.loadHistory(); // Refresh history

        } catch (error) {
            console.error('Upload error:', error);
            this.showError(error.message || 'Failed to analyze resumes. Please try again.');
        } finally {
            uploadBtn.classList.remove('loading');
            uploadBtn.disabled = false;
        }
    }

    displayResults(results) {
        const resultsSection = document.getElementById('resultsSection');
        resultsSection.style.display = 'block';

        // Display summary statistics
        this.displaySummaryStats(results.summary);
        
        // Display job keywords
        this.displayJobKeywords(results.jobKeywords);
        
        // Display ranked resumes
        this.displayResumeRankings(results.rankedResumes);

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    displaySummaryStats(summary) {
        const summaryContainer = document.getElementById('summaryStats');
        summaryContainer.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${summary.totalResumes}</span>
                <span class="stat-label">Total Resumes</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${summary.averageScore}%</span>
                <span class="stat-label">Average Score</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${summary.topScore}%</span>
                <span class="stat-label">Top Score</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${summary.topCandidate}</span>
                <span class="stat-label">Top Candidate</span>
            </div>
        `;
    }

    displayJobKeywords(keywords) {
        const keywordsContainer = document.getElementById('jobKeywords');
        const keywordTags = keywords.slice(0, 15).map(keyword => 
            `<span class="keyword-tag">${keyword.keyword} <span class="keyword-tag frequency">${keyword.frequency}</span></span>`
        ).join('');

        keywordsContainer.innerHTML = `
            <div class="keywords-section">
                <h3>Key Job Requirements</h3>
                <div class="keywords-grid">
                    ${keywordTags}
                </div>
            </div>
        `;
    }

    displayResumeRankings(resumes) {
        const rankingsContainer = document.getElementById('resumeRankings');
        const resumeItems = resumes.map((resume, index) => {
            const scoreClass = this.getScoreClass(resume.score);
            
            return `
                <div class="resume-item">
                    <div class="resume-header">
                        <div class="resume-title">#${index + 1} ${resume.filename}</div>
                        <div class="score-badge ${scoreClass}">${resume.score}% Match</div>
                    </div>
                    
                    <div class="resume-details">
                        <div class="detail-section">
                            <h4>Matching Skills (${resume.matchingKeywords.length})</h4>
                            <div class="keyword-list">
                                ${resume.matchingKeywords.map(k => 
                                    `<span class="keyword-small">${k.keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Missing Skills (${resume.missingKeywords.length})</h4>
                            <div class="keyword-list">
                                ${resume.missingKeywords.slice(0, 10).map(k => 
                                    `<span class="keyword-small missing">${k.keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="feedback-section">
                        <h4>Analysis Feedback</h4>
                        <ul>
                            ${resume.feedback.map(feedback => `<li>${feedback}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }).join('');

        rankingsContainer.innerHTML = resumeItems;
    }

    getScoreClass(score) {
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    async downloadReport() {
        if (!this.currentAnalysisId) {
            this.showError('No analysis available for download.');
            return;
        }

        try {
            const response = await fetch(`/api/report/${this.currentAnalysisId}`);
            
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `resume-analysis-${this.currentAnalysisId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Download error:', error);
            this.showError('Failed to download report. Please try again.');
        }
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) return;

            const history = await response.json();
            this.displayHistory(history);

        } catch (error) {
            console.error('History loading error:', error);
        }
    }

    displayHistory(history) {
        const historyContainer = document.getElementById('historyList');
        
        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="empty-state">No previous analyses found</p>';
            return;
        }

        const historyItems = history.map(item => `
            <div class="history-item" onclick="app.loadAnalysis('${item.id}')">
                <div class="history-header">
                    <div class="history-title">Analysis #${item.id.slice(0, 8)}</div>
                    <div class="history-date">${new Date(item.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="history-stats">
                    <span>Resumes: ${item.resumeCount}</span>
                    <span>Top Score: ${item.topScore}%</span>
                </div>
            </div>
        `).join('');

        historyContainer.innerHTML = historyItems;
    }

    async loadAnalysis(analysisId) {
        try {
            const response = await fetch(`/api/analysis/${analysisId}`);
            if (!response.ok) throw new Error('Analysis not found');

            const data = await response.json();
            this.currentAnalysisId = analysisId;
            this.displayResults(data);

        } catch (error) {
            console.error('Load analysis error:', error);
            this.showError('Failed to load analysis.');
        }
    }

    showError(message) {
        const modal = document.getElementById('errorModal');
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = message;
        modal.style.display = 'block';
    }
}

// Initialize the application when the page loads
const app = new ResumeRanker();