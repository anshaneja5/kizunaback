const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
// const Recording = require('../models/Recording'); // Commented out for S3 migration
const auth = require('../middleware/auth');
const fs = require('fs');
const { uploadFileToS3, uploadJsonToS3, getJsonFromS3 } = require('../middleware/s3');
const AWS = require('aws-sdk');

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== 'audio/wav') {
            return cb(new Error('Only WAV files are allowed'));
        }
        cb(null, true);
    }
});

router.post('/audio', auth, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        // Save audio file to S3
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const s3AudioKey = `audio/${req.user.id}/${uniqueSuffix}.wav`;
        await uploadFileToS3(s3AudioKey, req.file.buffer, req.file.mimetype);

        // Save file temporarily for Python analysis
        const tempPath = path.join(__dirname, `temp-${uniqueSuffix}.wav`);
        fs.writeFileSync(tempPath, req.file.buffer);

        const pythonProcess = spawn('python', ['analysis/analyze_audio.py', tempPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let analysisData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            analysisData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            fs.unlinkSync(tempPath); // Clean up temp file
            try {
                const result = JSON.parse(analysisData);
                // Save analysis metadata to S3
                const s3MetaKey = `audio/${req.user.id}/${uniqueSuffix}.json`;
                const metadata = {
                    user: req.user.id,
                    audioFile: s3AudioKey,
                    transcribedText: result.transcribedText,
                    analysis: {
                        polarityScore: result.polarityScore,
                        subjectivityScore: result.subjectivityScore,
                        totalWords: result.totalWords,
                        uniqueWords: result.uniqueWords,
                        diversityScore: result.diversityScore,
                        avgSentenceLength: result.avgSentenceLength,
                        conjunctionCount: result.conjunctionCount,
                        diversityFeedback: result.diversityFeedback,
                        complexityFeedback: result.complexityFeedback
                    },
                    createdAt: new Date().toISOString()
                };
                await uploadJsonToS3(s3MetaKey, metadata);
                // Return both the analysis results and the S3 key
                res.json({
                    ...result,
                    s3AudioKey,
                    s3MetaKey
                });
            } catch (error) {
                res.status(500).json({ 
                    error: 'Failed to process analysis results',
                    details: error.message,
                    rawOutput: analysisData
                });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's recordings from S3
router.get('/recordings', auth, async (req, res) => {
    try {
        const s3 = new AWS.S3();
        const prefix = `audio/${req.user.id}/`;
        const params = {
            Bucket: 'kinabot-audio-storage',
            Prefix: prefix,
        };
        // List all objects in the user's folder
        const listed = await s3.listObjectsV2(params).promise();
        // Filter for .json files (metadata)
        const jsonFiles = listed.Contents.filter(obj => obj.Key.endsWith('.json'));
        // Fetch and parse each metadata file
        const recordings = await Promise.all(jsonFiles.map(async (file) => {
            try {
                const meta = await getJsonFromS3(file.Key);
                return { ...meta, s3MetaKey: file.Key };
            } catch (e) {
                return null;
            }
        }));
        res.json(recordings.filter(Boolean));
    } catch (error) {
        console.error('Error fetching recordings from S3:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});

module.exports = router;
