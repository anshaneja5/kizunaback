const express = require('express');
const router = express.Router();
const { generateInsights } = require('../analysis/gemini_analysis');
// const Recording = require('../models/Recording'); // Commented out for S3 migration
const auth = require('../middleware/auth');
const { getJsonFromS3, uploadJsonToS3 } = require('../middleware/s3');

router.post('/analyze', auth, async (req, res) => {
    try {
        const { s3MetaKey, analysisData } = req.body;
        if (!s3MetaKey || !analysisData) {
            return res.status(400).json({ error: 's3MetaKey and analysis data are required' });
        }
        // Fetch the analysis metadata from S3
        let recording;
        try {
            recording = await getJsonFromS3(s3MetaKey);
        } catch (e) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        // Verify the recording belongs to the user
        if (recording.user !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized access to recording' });
        }
        const insights = await generateInsights(analysisData);
        if (!insights.success) {
            return res.status(500).json({ error: insights.error });
        }
        // Update the recording with Gemini insights
        recording.geminiInsights = insights.insights;
        await uploadJsonToS3(s3MetaKey, recording);
        res.json({
            success: true,
            insights: insights.insights
        });
    } catch (error) {
        console.error('Error in Gemini analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 