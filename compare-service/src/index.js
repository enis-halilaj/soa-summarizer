const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3002;

const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 'of', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);

app.use(cors());
app.use(express.json());

// Endpoint to compare summaries from classic and AI summarizers
app.post('/compare', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Get summaries from both services
        const classicResponse = await axios.post('http://localhost:3001/summarize', { text });
        const aiResponse = await axios.post('http://localhost:3000/summarize', { text });

        const classicSummary = classicResponse.data.summary;
        const aiSummary = aiResponse.data.summary;

        // Calculate comparison metrics
        const comparison = {
            classicSummary,
            aiSummary,
            metrics: {
                // Length comparison
                classicLength: classicSummary.length,
                aiLength: aiSummary.length,
                lengthDifference: Math.abs(classicSummary.length - aiSummary.length),
                
                // Word count comparison
                classicWordCount: classicSummary.split(/\s+/).length,
                aiWordCount: aiSummary.split(/\s+/).length,
                wordCountDifference: Math.abs(
                    classicSummary.split(/\s+/).length - 
                    aiSummary.split(/\s+/).length
                ),
                
                // Content similarity (using Jaccard similarity)
                contentSimilarity: calculateSimilarity(classicSummary, aiSummary),
                
                // Information retention (approximate)
                informationRetention: {
                    classic: calculateInformationRetention(text, classicSummary),
                    ai: calculateInformationRetention(text, aiSummary)
                },
                
                // Quality metrics
                qualityMetrics: {
                    classic: {
                        coherence: calculateCoherence(classicSummary),
                        relevance: calculateRelevance(text, classicSummary),
                        fluency: calculateFluency(classicSummary)
                    },
                    ai: {
                        coherence: calculateCoherence(aiSummary),
                        relevance: calculateRelevance(text, aiSummary),
                        fluency: calculateFluency(aiSummary)
                    }
                }
            }
        };

        res.json(comparison);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Failed to compare summaries' });
    }
});

// Helper function to calculate Jaccard similarity between two texts
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
}

// Helper function to calculate approximate information retention
function calculateInformationRetention(original, summary) {
    const originalWords = new Set(original.toLowerCase().split(/\s+/).filter(w => !stopwords.has(w)));
    const summaryWords = new Set(summary.toLowerCase().split(/\s+/).filter(w => !stopwords.has(w)));
    
    const retainedWords = new Set([...summaryWords].filter(x => originalWords.has(x)));
    return retainedWords.size / originalWords.size;
}

// Helper function to calculate coherence
function calculateCoherence(summary) {
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 1) return 1.0; // If only one sentence, coherence is perfect

    let coherenceScore = 0;
    for (let i = 0; i < sentences.length - 1; i++) {
        const currentSentence = sentences[i].toLowerCase();
        const nextSentence = sentences[i + 1].toLowerCase();
        
        // Check for common words between sentences
        const currentWords = new Set(currentSentence.split(/\s+/).filter(w => !stopwords.has(w)));
        const nextWords = new Set(nextSentence.split(/\s+/).filter(w => !stopwords.has(w)));
        
        const commonWords = new Set([...currentWords].filter(x => nextWords.has(x)));
        coherenceScore += commonWords.size / Math.max(currentWords.size, nextWords.size);
    }
    
    return coherenceScore / (sentences.length - 1);
}

// Helper function to calculate relevance
function calculateRelevance(original, summary) {
    const originalWords = new Set(original.toLowerCase().split(/\s+/).filter(w => !stopwords.has(w)));
    const summaryWords = new Set(summary.toLowerCase().split(/\s+/).filter(w => !stopwords.has(w)));
    
    const commonWords = new Set([...summaryWords].filter(x => originalWords.has(x)));
    return commonWords.size / summaryWords.size;
}

// Helper function to calculate fluency
function calculateFluency(summary) {
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0.0;

    let fluencyScore = 0;
    for (const sentence of sentences) {
        const words = sentence.split(/\s+/);
        if (words.length < 3) continue; // Skip very short sentences

        // Check for basic grammar indicators
        const hasSubject = words.some(w => !stopwords.has(w.toLowerCase()));
        const hasVerb = words.some(w => w.toLowerCase().endsWith('ing') || w.toLowerCase().endsWith('ed'));
        
        if (hasSubject && hasVerb) {
            fluencyScore += 1;
        }
    }
    
    return fluencyScore / sentences.length;
}

app.listen(port, () => {
    console.log(`Compare service running at http://localhost:${port}`);
}); 