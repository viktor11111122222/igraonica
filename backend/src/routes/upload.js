const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_TYPE'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// POST /api/upload/image - admin uploaduje sliku
router.post(
  '/image',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err.message === 'INVALID_TYPE') {
          return res.status(400).json({ message: 'Dozvoljeni formati: JPEG, PNG, WebP, GIF.' });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Fajl ne sme biti veci od 5MB.' });
        }
        return res.status(400).json({ message: 'Greska pri uploadu.' });
      }
      next();
    });
  },
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Slika je obavezna.' });
    }

    const url = `/uploads/${req.file.filename}`;

    res.status(201).json({
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }
);

// DELETE /api/upload/:filename - admin brise sliku
router.delete(
  '/:filename',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);

    // Sprecava path traversal
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(uploadDir))) {
      return res.status(400).json({ message: 'Nevazeci naziv fajla.' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Fajl nije pronadjen.' });
    }

    fs.unlinkSync(filePath);
    res.json({ message: 'Fajl je obrisan.' });
  }
);

module.exports = router;
