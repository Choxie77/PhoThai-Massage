import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTransport, sendWithRetry } from './emailService.js';
import { initDb, logEmail } from './db.js';

dotenv.config();

// Ensure data directory exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Allow all origins to support file:// previews and local testing
app.use(cors());

// Simple in-memory rate limiting per recipient
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const maxPerWindow = Number(process.env.RATE_LIMIT_MAX || 5);
const rateMap = new Map(); // key: recipient, value: array of timestamps

function checkRate(recipient) {
  const now = Date.now();
  const arr = rateMap.get(recipient) || [];
  const filtered = arr.filter((ts) => now - ts < windowMs);
  if (filtered.length >= maxPerWindow) return false;
  filtered.push(now);
  rateMap.set(recipient, filtered);
  return true;
}

function sanitize(str) {
  return String(str || '').trim();
}

function renderTemplate(tpl, data) {
  return tpl
    .replace(/\{\{service\}\}/g, sanitize(data.service))
    .replace(/\{\{date\}\}/g, sanitize(data.date))
    .replace(/\{\{time\}\}/g, sanitize(data.time))
    .replace(/\{\{supportEmail\}\}/g, sanitize(data.supportEmail))
    .replace(/\{\{notesBlock\}\}/g, data.notes ? `Notes: ${sanitize(data.notes)}` : '');
}

app.post('/api/bookings', async (req, res) => {
  try {
    await initDb();

    const { name, phone, service, date, time, notes, confirmationEmail, subject, replyTo } = req.body || {};

    // Validate required fields
    const required = { name, phone, service, date, time, confirmationEmail, subject };
    const missing = Object.entries(required)
      .filter(([_, v]) => !sanitize(v))
      .map(([k]) => k);
    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Missing fields: ${missing.join(', ')}` });
    }

    // Rate limiting per recipient
    if (!checkRate(confirmationEmail)) {
      return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
    }

    const supportEmail = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || replyTo || 'info@thaimassage.com';
    const fromAddress = process.env.FROM_EMAIL || replyTo || 'info@thaimassage.com';

    const htmlTpl = fs.readFileSync(path.resolve(__dirname, './templates/confirmation.html'), 'utf8');
    const txtTpl = fs.readFileSync(path.resolve(__dirname, './templates/confirmation.txt'), 'utf8');
    const htmlBody = renderTemplate(htmlTpl, { service, date, time, notes, supportEmail });
    const txtBody = renderTemplate(txtTpl, { service, date, time, notes, supportEmail });

    // Prepare mail options
    const mailOptions = {
      from: fromAddress,
      to: confirmationEmail,
      subject: sanitize(subject),
      text: txtBody,
      html: htmlBody,
      replyTo: replyTo || fromAddress,
    };

    // Send email with retry
    const transporter = createTransport();
    const result = await sendWithRetry(transporter, mailOptions, 3);

    if (result.ok) {
      console.log(`Email sent to ${confirmationEmail} (attempts: ${result.attempts})`);
      await logEmail({ recipient: confirmationEmail, subject, content: txtBody, status: 'success', attempts: result.attempts });
      return res.json({ ok: true });
    }

    console.error(`Email failed to ${confirmationEmail}: ${result.error}`);
    await logEmail({ recipient: confirmationEmail, subject, content: txtBody, status: 'failure', errorMessage: result.error, attempts: result.attempts });
    return res.status(502).json({ ok: false, error: 'Email send failed', detail: result.error });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error', detail: String(err) });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Email service listening on http://localhost:${PORT}`);
});