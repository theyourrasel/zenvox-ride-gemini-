require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const app = express();
const port = Number(process.env.PORT || 3000);
const maxMb = Math.min(20, Math.max(1, Number(process.env.MAX_UPLOAD_MB || 12)));
const allowedOrigins = String(process.env.FRONTEND_ORIGIN || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  // Permit server-to-server and same-origin requests without an Origin header.
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed by CORS'));
} }));
app.use(express.json({ limit: '1mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMb * 1024 * 1024, files: 1 } });
app.get('/health', (_req, res) => res.json({ ok: true, service: 'zenvox-ai-backend' }));
app.post('/api/ai/chat', upload.single('file'), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to the Render Web Service environment variables.' });
    }
    const question = String(req.body.message || 'Please analyze the attached file.').slice(0, 12000);
    const parts = [{ text: `You are ZenvoX Ride AI. Be helpful, safety-conscious, and clear. For risky vehicle, medical, legal, or road-safety matters, explain uncertainty and recommend a qualified professional when appropriate.\n\nUser message:\n${question}` }];
    const file = req.file;
    if (file) {
      const type = String(file.mimetype || '').toLowerCase();
      const name = String(file.originalname || 'attachment').slice(0, 180);
      if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) {
        parts.push({ inlineData: { mimeType: type, data: file.buffer.toString('base64') } });
      } else if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
        const parsed = await pdfParse(file.buffer);
        parts.push({ text: `Extracted PDF text from ${name}:\n${String(parsed.text || '').slice(0, 60000) || '[No selectable text found; this PDF may be scanned.]'}` });
      } else if (/^(text\/|application\/(json|csv))/.test(type) || /\.(txt|csv|md|json|js|html|css)$/i.test(name)) {
        parts.push({ text: `File ${name}:\n${file.buffer.toString('utf8').slice(0, 60000)}` });
      } else {
        return res.status(415).json({ error: 'Unsupported file type. Use an image, text/code file, CSV, JSON, or text-based PDF.' });
      }
    }
    const model = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { maxOutputTokens: 1800, temperature: 0.7 } })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Gemini API error:', upstream.status, data.error?.message || 'unknown error');
      return res.status(upstream.status >= 400 && upstream.status < 500 ? 502 : 503).json({ error: data.error?.message || 'Gemini provider request failed. Check model name, API key, and quota.' });
    }
    const reply = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
    if (!reply) return res.status(502).json({ error: 'Gemini returned no text. The request may have been blocked by safety settings.' });
    res.json({ reply });
  } catch (error) {
    console.error('Gemini request failed:', error.message);
    res.status(500).json({ error: 'Could not process this request. Check backend logs and file format.' });
  }
});
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(413).json({ error: `Upload rejected: ${err.message}` });
  res.status(500).json({ error: 'Unexpected backend error.' });
});
app.listen(port, () => console.log(`ZenvoX AI backend listening on ${port}`));
