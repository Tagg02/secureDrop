const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const authenticate = require("../middleware/authMiddleware");
const File = require("../models/File");
const { encryptBuffer, decryptBuffer } = require("../crypto");

const router = express.Router();

const allowedTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv"
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  }
});

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  }
});

const BUCKET = process.env.AWS_BUCKET;

/* UPLOAD FILE */
router.post("/upload", authenticate, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const ext = path.extname(req.file.originalname);
    const s3Key = uuidv4() + ext;
    const encryptedBuffer = encryptBuffer(req.file.buffer);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: encryptedBuffer,
      ContentType: "application/octet-stream"
    }));

    const file = await File.create({
      originalName: req.file.originalname,
      storedName: s3Key,
      uploadedBy: req.user.id,
      size: req.file.size,
      mimeType: req.file.mimetype
    });

    res.json({ message: "File uploaded securely", file });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

/* GET USER FILES */
router.get("/", authenticate, async (req, res) => {
  const files = await File.findByUser(req.user.id);
  res.json(files.map(f => ({
    _id: f.FileID,
    originalName: f.OrigName,
    size: f.Size,
    mimeType: f.MimeType,
    createdAt: f.UploadedAt
  })));
});

/* DOWNLOAD FILE */
router.get("/:id", authenticate, async (req, res) => {
  const file = await File.findById(req.params.id);

  if (!file) return res.status(404).json({ message: "File not found" });
  if (file.UserID !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const data = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: file.StoredName
    }));

    const chunks = [];
    for await (const chunk of data.Body) chunks.push(chunk);
    const decrypted = decryptBuffer(Buffer.concat(chunks));

    res.setHeader("Content-Disposition", `attachment; filename="${file.OrigName}"`);
    res.setHeader("Content-Type", file.MimeType);
    res.send(decrypted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Download failed" });
  }
});

/* DELETE FILE */
router.delete("/:id", authenticate, async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.status(404).json({ message: "File not found" });

  if (req.user.role !== "admin" && file.UserID !== req.user.id) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: file.StoredName
    }));
  } catch (err) {
    console.error("S3 delete error:", err);
  }

  await File.deleteById(req.params.id);
  res.json({ message: "File deleted successfully" });
});

module.exports = router;
