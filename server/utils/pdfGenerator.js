import { jsPDF } from 'jspdf';

export async function generatePDFReport(analysisData) {
  try {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const maxWidth = 170;
    
    // Helper function to add new page if needed
    function checkNewPage(requiredHeight = 20) {
      if (yPosition + requiredHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = 20;
      }
    }
    
    // Helper function to add text with word wrapping
    function addWrappedText(text, x, y, maxWidth) {
      if (!text || typeof text !== 'string') {
        return 7; // Return minimal height for empty text
      }
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return lines.length * 7; // Return height used
    }
    
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Resume Analysis Report', 20, yPosition);
    yPosition += 15;
    
    // Summary section
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis Summary', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    // Ensure summary data exists
    const summary = analysisData.summary || {};
    const summaryText = [
      `Total Resumes Analyzed: ${summary.totalResumes || 0}`,
      `Average Score: ${summary.averageScore || 0}%`,
      `Top Score: ${summary.topScore || 0}%`,
      `Top Candidate: ${summary.topCandidate || 'None'}`,
      `Analysis Date: ${analysisData.timestamp ? new Date(analysisData.timestamp).toLocaleDateString() : new Date().toLocaleDateString()}`
    ];
    
    summaryText.forEach(text => {
      checkNewPage();
      doc.text(text, 20, yPosition);
      yPosition += 7;
    });
    
    yPosition += 10;
    
    // Job Keywords section
    if (analysisData.jobKeywords && analysisData.jobKeywords.length > 0) {
      checkNewPage(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Job Requirements', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const topKeywords = analysisData.jobKeywords.slice(0, 10)
        .map(k => `${k.keyword || ''} (${k.frequency || 0})`)
        .join(', ');
      
      if (topKeywords) {
        const keywordHeight = addWrappedText(topKeywords, 20, yPosition, maxWidth);
        yPosition += keywordHeight + 10;
      }
    }
    
    // Individual resume analysis
    if (analysisData.rankedResumes && analysisData.rankedResumes.length > 0) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      checkNewPage(30);
      doc.text('Individual Resume Analysis', 20, yPosition);
      yPosition += 15;
      
      analysisData.rankedResumes.forEach((resume, index) => {
        checkNewPage(60);
        
        // Resume header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const filename = resume.filename || `Resume ${index + 1}`;
        doc.text(`${index + 1}. ${filename}`, 20, yPosition);
        yPosition += 10;
        
        // Score and match percentage
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const score = resume.score || 0;
        const matchPercentage = resume.matchPercentage || 0;
        doc.text(`Overall Score: ${score}% | Keyword Match: ${matchPercentage}%`, 20, yPosition);
        yPosition += 8;
        
        // Matching keywords
        if (resume.matchingKeywords && resume.matchingKeywords.length > 0) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Matching Skills:', 20, yPosition);
          yPosition += 6;
          
          doc.setFont('helvetica', 'normal');
          const matchingText = resume.matchingKeywords
            .map(k => k.keyword || '')
            .filter(k => k)
            .join(', ');
          
          if (matchingText) {
            const matchingHeight = addWrappedText(matchingText, 20, yPosition, maxWidth);
            yPosition += matchingHeight + 5;
          }
        }
        
        // Missing keywords
        if (resume.missingKeywords && resume.missingKeywords.length > 0) {
          checkNewPage(20);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Missing Skills:', 20, yPosition);
          yPosition += 6;
          
          doc.setFont('helvetica', 'normal');
          const missingText = resume.missingKeywords
            .map(k => k.keyword || '')
            .filter(k => k)
            .join(', ');
          
          if (missingText) {
            const missingHeight = addWrappedText(missingText, 20, yPosition, maxWidth);
            yPosition += missingHeight + 5;
          }
        }
        
        // Feedback
        if (resume.feedback && resume.feedback.length > 0) {
          checkNewPage(25);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Feedback:', 20, yPosition);
          yPosition += 6;
          
          doc.setFont('helvetica', 'normal');
          resume.feedback.forEach(feedback => {
            if (feedback && typeof feedback === 'string') {
              checkNewPage(15);
              const feedbackHeight = addWrappedText(`• ${feedback}`, 25, yPosition, maxWidth - 5);
              yPosition += feedbackHeight + 3;
            }
          });
        }
        
        yPosition += 10;
        
        // Add separator line
        if (index < analysisData.rankedResumes.length - 1) {
          checkNewPage(10);
          doc.setLineWidth(0.1);
          doc.line(20, yPosition, 190, yPosition);
          yPosition += 10;
        }
      });
    }
    
    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${pageCount} - Generated by ResumeRanker`,
        20,
        pageHeight - 10
      );
    }
    
    // Return the PDF as a proper buffer
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}