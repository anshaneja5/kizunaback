const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'kinabot-audio-storage';

// Upload a file buffer to S3
function uploadFileToS3(key, buffer, contentType) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  };
  return s3.upload(params).promise();
}

// Download a file from S3
function getFileFromS3(key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };
  return s3.getObject(params).promise();
}

// Upload JSON metadata to S3
function uploadJsonToS3(key, jsonData) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(jsonData),
    ContentType: 'application/json',
  };
  return s3.upload(params).promise();
}

// Download JSON metadata from S3
async function getJsonFromS3(key) {
  const data = await getFileFromS3(key);
  return JSON.parse(data.Body.toString('utf-8'));
}

module.exports = {
  uploadFileToS3,
  getFileFromS3,
  uploadJsonToS3,
  getJsonFromS3,
}; 