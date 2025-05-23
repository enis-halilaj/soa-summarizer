const express = require('express');
const natural = require('natural');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Initialize NLP tools
const tokenizer = new natural.SentenceTokenizer();
const TfIdf = natural.TfIdf;
const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 'of', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);

function summarizeText(text) {
    // Clean and normalize the text
    text = text.trim().replace(/\s+/g, ' ');
    
    // Split text into sentences
    const sentences = tokenizer.tokenize(text);
    
    if (sentences.length <= 2) {
        return text; // Return original text if too short
    }
    
    // Create TF-IDF instance
    const tfidf = new TfIdf();
    tfidf.addDocument(text);
    
    // Calculate sentence scores using multiple factors
    const sentenceScores = sentences.map(sentence => {
        const words = sentence.toLowerCase().split(/\s+/);
        
        // Factor 1: TF-IDF score (weighted more heavily)
        const tfidfScore = words.reduce((sum, word) => {
            if (!stopwords.has(word)) {
                const termScore = tfidf.tfidf(word, 0);
                return sum + (termScore || 0);
            }
            return sum;
        }, 0) * 2; // Double the weight of TF-IDF score
        
        // Factor 2: Position score (first and last sentences are often important)
        const positionScore = sentences.indexOf(sentence) === 0 ? 1.0 : 
                            sentences.indexOf(sentence) === sentences.length - 1 ? 0.8 : 0;
        
        // Factor 3: Length score (prefer medium-length sentences)
        const lengthScore = words.length > 5 && words.length < 20 ? 0.5 : 0;
        
        // Factor 4: Keyword presence (sentences with important words)
        const keywordScore = words.some(word => 
            !stopwords.has(word) && word.length > 4) ? 0.3 : 0;
        
        // Factor 5: Sentence position in the text (earlier sentences often more important)
        const positionInTextScore = 1 - (sentences.indexOf(sentence) / sentences.length);
        
        // Combine all factors with weights
        const totalScore = (tfidfScore * 0.4) + 
                          (positionScore * 0.2) + 
                          (lengthScore * 0.15) + 
                          (keywordScore * 0.15) + 
                          (positionInTextScore * 0.1);
        
        return { sentence, score: totalScore };
    });
    
    // Sort sentences by score
    sentenceScores.sort((a, b) => b.score - a.score);
    
    // Select top 30% of sentences, but at least 2 sentences
    const summaryLength = Math.max(2, Math.ceil(sentences.length * 0.3));
    const topSentences = sentenceScores.slice(0, summaryLength);
    
    // Sort sentences back to original order
    topSentences.sort((a, b) => {
        return sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence);
    });
    
    // Join sentences to form summary
    const summary = topSentences.map(item => item.sentence).join(' ');
    
    // If summary is longer than original, return original
    return summary.length < text.length ? summary : text;
}

app.post('/summarize', (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const summary = summarizeText(text);
        
        res.json({
            originalLength: text.length,
            summaryLength: summary.length,
            summary: summary
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Failed to generate summary' });
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

app.listen(port, () => {
    console.log(`Classic Summarizer service running at http://localhost:${port}`);
}); 