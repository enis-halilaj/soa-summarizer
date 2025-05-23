const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Endpoint to summarize text using Llama2
app.post('/summarize', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Call Ollama API
        const response = await axios.post('http://127.0.0.1:11434/api/generate', {
            model: 'llama2',
            prompt: `Summarize the following text in a concise way, maintaining the key points:\n\n${text}`,
            stream: false
        });

        const summary = response.data.response;
        
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

app.listen(port, () => {
    console.log(`AI Summarizer service running at http://localhost:${port}`);
}); 