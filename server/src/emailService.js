import nodemailer from 'nodemailer';

export function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is missing. Please set env vars.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587/others
    auth: { user, pass },
  });
}

export async function sendWithRetry(transporter, mailOptions, maxAttempts = 3) {
  let attempt = 0;
  let lastError = null;
  while (attempt < maxAttempts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const info = await transporter.sendMail(mailOptions);
      return { ok: true, info, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      attempt += 1;
      // exponential backoff: 500ms, 1500ms, 4500ms
      const delay = 500 * Math.pow(3, attempt - 1);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  return { ok: false, error: String(lastError || 'Unknown error'), attempts: attempt };
}