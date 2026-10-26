require("dotenv").config();

const express = require("express");
const multer = require("multer");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const app = express();
const PORT = process.env.PORT || 5000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);

class InvalidFileTypeError extends Error {
  constructor() {
    super("Invalid file type. Only JPG, PNG, and GIF are allowed.");
    this.name = "InvalidFileTypeError";
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new InvalidFileTypeError());
      return;
    }

    callback(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE },
});

function getStorageClient() {
  const {
    AWS_ACCESS_KEY_ID,
    AWS_ENDPOINT_URL_S3,
    AWS_REGION,
    AWS_SECRET_ACCESS_KEY,
  } = process.env;

  if (!AWS_ACCESS_KEY_ID || !AWS_ENDPOINT_URL_S3 || !AWS_REGION || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("Neon Object Storage credentials are not configured.");
  }

  return new S3Client({
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

function getPublicUrl(objectName) {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3.replace(/\/$/, "");
  return `${endpoint}/uploads/${encodeURIComponent(objectName)}`;
}

app.post("/api/upload", upload.single("image"), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const storage = getStorageClient();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${req.file.originalname}`;
    await storage.send(new PutObjectCommand({
      Bucket: "uploads",
      Key: uniqueName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    res.status(200).json({
      message: "File uploaded successfully",
      file: {
        originalName: req.file.originalname,
        url: getPublicUrl(uniqueName),
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error instanceof InvalidFileTypeError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "File too large. Maximum size is 5 MB." });
    return;
  }

  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }

  console.error("Upload failed:", error);
  res.status(500).json({ error: "Failed to upload file to storage" });
});

app.listen(PORT, () => {
  console.log(`Upload server listening on port ${PORT}`);
});

module.exports = app;