import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { GoogleGenAI, Type } from '@google/genai';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface FirebaseAppletConfig {
  projectId: string;
}

const firebaseConfigPath = path.resolve(ROOT_DIR, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(
  fs.readFileSync(firebaseConfigPath, 'utf-8')
) as FirebaseAppletConfig;

const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });

interface AuthenticatedRequest extends Request {
  authUser?: DecodedIdToken;
}

const ALLOWED_UNITS = [
  'Sekretariat Umum',
  'Direksi / Pimpinan',
  'Bagian Keuangan',
  'Bagian SDM & Kepegawaian',
  'Hukum & Kepatuhan',
  'Operasional & Layanan',
  'Teknologi Informasi',
  'Pengadaan & Aset',
  'Eksternal / Instansi Luar',
];

const SAFE_UID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const SAFE_STORED_FILE_PATTERN = /^[a-zA-Z0-9_-]{1,120}\.(pdf|docx|doc)$/;

function detectFileKind(
  originalName: string,
  mimeType: string,
  buffer: Buffer
): { ext: 'pdf' | 'docx' | 'doc'; canonicalMime: string } | null {
  const lowerName = originalName.toLowerCase();
  const ext = path.extname(lowerName);

  // Magic byte verification
  const isPdfMagic =
    buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const isZipMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
  const isOleMagic =
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;
  const isRtfMagic =
    buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '{\\rtf';

  if (
    (ext === '.pdf' || mimeType === 'application/pdf') &&
    isPdfMagic
  ) {
    return { ext: 'pdf', canonicalMime: 'application/pdf' };
  }

  if (
    (ext === '.docx' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document') &&
    isZipMagic
  ) {
    return {
      ext: 'docx',
      canonicalMime:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  if (
    (ext === '.doc' || mimeType === 'application/msword') &&
    (isOleMagic || isRtfMagic)
  ) {
    return { ext: 'doc', canonicalMime: 'application/msword' };
  }

  return null;
}

async function requireVerifiedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const customTokenHeader = req.headers['x-firebase-auth'];
  const authHeader = req.headers.authorization;

  let idToken = '';
  if (typeof customTokenHeader === 'string' && customTokenHeader.trim()) {
    idToken = customTokenHeader.trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.slice(7).trim();
  }

  if (!idToken) {
    res.status(401).json({ error: 'Autentikasi diperlukan.' });
    return;
  }

  try {
    const decoded = await getAdminAuth(adminApp).verifyIdToken(idToken);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'Email akun Google belum terverifikasi.' });
      return;
    }
    req.authUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Sesi autentikasi tidak valid atau telah kedaluwarsa.' });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

async function extractWordText(
  ext: 'docx' | 'doc',
  buffer: Buffer
): Promise<string> {
  if (ext === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 0) {
        return result.value.trim();
      }
    } catch {
      // Fall through to WordExtractor
    }
  }

  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  const parts = [
    doc.getHeaders({ includeFooters: false }),
    doc.getBody(),
    doc.getFooters(),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  return parts;
}

async function extractMetadataWithGemini(params: {
  ext: 'pdf' | 'docx' | 'doc';
  buffer: Buffer;
  textContent?: string;
  fileName: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi pada server. Isi data surat secara manual atau atur secret GEMINI_API_KEY.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const promptInstruction = `Analisis dokumen surat resmi berikut (nama file: "${params.fileName}") dan ekstrak metadata persuratan ke dalam JSON terstruktur berbahasa Indonesia.
Panduan pengisian:
- direction: 'masuk' jika surat ditujukan ke instansi/organisasi internal dari pihak luar atau merupakan surat masuk; 'keluar' jika diterbitkan oleh internal untuk pihak lain. Jika ragu, gunakan 'masuk'.
- letterNumber: nomor surat resmi yang tertera di kepala/atas surat (jika tidak ditemukan, isi string kosong "").
- subject: perihal atau pokok surat (maksimal 240 karakter; jika tidak eksplisit, simpulkan dari isi surat).
- sender: nama instansi, unit, atau pejabat pengirim surat.
- recipient: nama instansi, unit, atau pejabat penerima/tujuan surat.
- letterDate: tanggal surat dalam format YYYY-MM-DD (konversi tanggal bahasa Indonesia seperti "23 November 2026" ke "2026-11-23"; jika tidak ada tanggal sama sekali, gunakan "${today}").
- priority: pilih paling sesuai dari ['Biasa', 'Penting', 'Segera', 'Rahasia'].
- classification: pilih paling sesuai dari ['Umum', 'Undangan', 'Keputusan', 'Keuangan', 'Kepegawaian', 'Nota Dinas'].
- suggestedUnit: pilih satu unit internal yang paling relevan menangani surat ini dari daftar persis berikut: ${ALLOWED_UNITS.join(', ')}.
- summary: ringkasan isi pokok surat dalam 1-3 kalimat bahasa Indonesia yang jelas (maksimal 600 karakter).`;

  const contents =
    params.ext === 'pdf'
      ? {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: params.buffer.toString('base64'),
              },
            },
            { text: promptInstruction },
          ],
        }
      : `${promptInstruction}\n\n--- ISI DOKUMEN WORD ---\n${(
          params.textContent || ''
        ).slice(0, 30000)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          direction: {
            type: Type.STRING,
            enum: ['masuk', 'keluar'],
          },
          letterNumber: { type: Type.STRING },
          subject: { type: Type.STRING },
          sender: { type: Type.STRING },
          recipient: { type: Type.STRING },
          letterDate: { type: Type.STRING },
          priority: {
            type: Type.STRING,
            enum: ['Biasa', 'Penting', 'Segera', 'Rahasia'],
          },
          classification: {
            type: Type.STRING,
            enum: [
              'Umum',
              'Undangan',
              'Keputusan',
              'Keuangan',
              'Kepegawaian',
              'Nota Dinas',
            ],
          },
          suggestedUnit: {
            type: Type.STRING,
            enum: ALLOWED_UNITS,
          },
          summary: { type: Type.STRING },
        },
        required: [
          'direction',
          'letterNumber',
          'subject',
          'sender',
          'recipient',
          'letterDate',
          'priority',
          'classification',
          'suggestedUnit',
          'summary',
        ],
      },
    },
  });

  let rawJson = (response.text ?? '{}').trim();
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return JSON.parse(rawJson) as {
    direction: 'masuk' | 'keluar';
    letterNumber: string;
    subject: string;
    sender: string;
    recipient: string;
    letterDate: string;
    priority: 'Biasa' | 'Penting' | 'Segera' | 'Rahasia';
    classification:
      | 'Umum'
      | 'Undangan'
      | 'Keputusan'
      | 'Keuangan'
      | 'Kepegawaian'
      | 'Nota Dinas';
    suggestedUnit: string;
    summary: string;
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post(
    '/api/extract-letter',
    requireVerifiedUser,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      upload.single('file')(req, res, (err: unknown) => {
        if (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Gagal mengunggah berkas.';
          res.status(400).json({ error: message });
          return;
        }
        next();
      });
    },
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const uid = req.authUser?.uid;
        if (!uid || !SAFE_UID_PATTERN.test(uid)) {
          res.status(401).json({ error: 'Identitas pengguna tidak valid.' });
          return;
        }

        if (!req.file) {
          res
            .status(400)
            .json({ error: 'Pilih file surat berformat PDF atau Word (.doc/.docx).' });
          return;
        }

        const kind = detectFileKind(
          req.file.originalname,
          req.file.mimetype,
          req.file.buffer
        );
        if (!kind) {
          res.status(400).json({
            error:
              'Format berkas tidak valid. Unggah file asli berformat .pdf, .docx, atau .doc (maksimal 10 MB).',
          });
          return;
        }

        const userDir = path.resolve(UPLOADS_DIR, uid);
        if (!userDir.startsWith(UPLOADS_DIR + path.sep)) {
          res.status(403).json({ error: 'Lokasi penyimpanan tidak diizinkan.' });
          return;
        }
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }

        const fileId = `doc_${Date.now().toString(36)}_${crypto
          .randomBytes(6)
          .toString('hex')}`;
        const storedName = `${fileId}.${kind.ext}`;
        const targetPath = path.resolve(userDir, storedName);

        if (!targetPath.startsWith(userDir + path.sep)) {
          res.status(403).json({ error: 'Nama berkas tidak valid.' });
          return;
        }

        fs.writeFileSync(targetPath, req.file.buffer);

        const safeOriginalName = path
          .basename(req.file.originalname)
          .replace(/[\r\n]/g, '')
          .slice(0, 255);

        const fileMeta = {
          fileName: safeOriginalName,
          fileUrl: `/api/files/${uid}/${storedName}`,
          fileMime: kind.canonicalMime,
          fileSize: req.file.size,
        };

        let extractedText = '';
        if (kind.ext === 'docx' || kind.ext === 'doc') {
          try {
            extractedText = await extractWordText(kind.ext, req.file.buffer);
          } catch (wordErr) {
            res.status(422).json({
              error:
                wordErr instanceof Error
                  ? `Gagal membaca isi file Word: ${wordErr.message}`
                  : 'Gagal membaca isi file Word.',
              file: fileMeta,
            });
            return;
          }

          if (!extractedText.trim()) {
            res.status(422).json({
              error:
                'Dokumen Word berhasil dilampirkan, tetapi tidak ditemukan teks yang dapat dibaca otomatis. Silakan lengkapi kolom surat secara manual.',
              file: fileMeta,
            });
            return;
          }
        }

        try {
          const extracted = await extractMetadataWithGemini({
            ext: kind.ext,
            buffer: req.file.buffer,
            textContent: extractedText,
            fileName: safeOriginalName,
          });

          res.json({
            extracted,
            file: fileMeta,
          });
        } catch (aiErr) {
          const message =
            aiErr instanceof Error
              ? aiErr.message
              : 'Gagal mengekstrak isi surat dengan layanan AI.';
          res.status(502).json({
            error: `Berkas berhasil dilampirkan, namun pembacaan otomatis gagal: ${message}`,
            file: fileMeta,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terjadi kesalahan server.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.get(
    '/api/files/:ownerUid/:storedName',
    requireVerifiedUser,
    (req: AuthenticatedRequest, res: Response) => {
      const ownerUid = String(req.params.ownerUid || '');
      const storedName = String(req.params.storedName || '');

      if (
        !SAFE_UID_PATTERN.test(ownerUid) ||
        !SAFE_STORED_FILE_PATTERN.test(storedName)
      ) {
        res.status(400).json({ error: 'Parameter berkas tidak valid.' });
        return;
      }

      const callerUid = req.authUser?.uid;
      const isBootstrapAdmin =
        req.authUser?.email === 'babelhendri@gmail.com' &&
        req.authUser?.email_verified === true;

      if (callerUid !== ownerUid && !isBootstrapAdmin) {
        res.status(403).json({ error: 'Anda tidak memiliki akses ke berkas ini.' });
        return;
      }

      const resolvedPath = path.resolve(UPLOADS_DIR, ownerUid, storedName);
      if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
        res.status(403).json({ error: 'Akses berkas ditolak.' });
        return;
      }

      if (!fs.existsSync(resolvedPath)) {
        res.status(404).json({ error: 'Berkas surat tidak ditemukan di penyimpanan.' });
        return;
      }

      const ext = path.extname(storedName).toLowerCase();
      const contentType =
        ext === '.pdf'
          ? 'application/pdf'
          : ext === '.docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/msword';

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${storedName}"`
      );
      res.sendFile(resolvedPath);
    }
  );

  // Ensure any unmatched /api/* route or Express error returns JSON, never HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  app.use(
    '/api',
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      const message =
        err instanceof Error ? err.message : 'Terjadi kesalahan pada server API.';
      res.status(500).json({ error: message });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TataSurat server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
