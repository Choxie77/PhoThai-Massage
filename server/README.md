# PhoThai Email Service (SMTP + SQLite)

Backend for automated booking confirmation emails with:
- SMTP via Nodemailer (configurable with environment variables)
- SQLite logging of all email attempts and outcomes
- Rate limiting and retry logic
- JSON API consumed by the site’s booking form

## Setup

1. Install Node.js (LTS) on your machine.
2. In `server/`, run `npm install`.
3. Copy `.env.example` to `.env` and set your SMTP credentials:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=YOUR_SMTP_USERNAME
SMTP_PASS=YOUR_SMTP_PASSWORD_OR_APP_PASSWORD
FROM_EMAIL=info@thaimassage.com
SUPPORT_EMAIL=info@thaimassage.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=5
```

For Gmail, use an App Password (requires 2FA) instead of your main password.

4. Start the server:

```
npm run start
```

This launches on `http://localhost:3000`.

## API

`POST /api/bookings`

Payload (JSON):

```
{
  "name": "Customer Name",
  "phone": "123456789",
  "service": "Thai Massage",
  "date": "2025-11-20",
  "time": "14:00",
  "notes": "Optional notes",
  "confirmationEmail": "alovrencak1@gmail.com",
  "subject": "Booking Confirmation",
  "replyTo": "info@thaimassage.com"
}
```

Response:

```
{ "ok": true }
```

Errors:
- 400 Missing fields
- 429 Rate limited
- 502 Email send failed
- 500 Server error

## Database

SQLite file is created at `server/data/email.db`.
Table: `email_logs (recipient, subject, content, status, error_message, attempts, created_at, updated_at)`.

## Testing

- Update `Index.html` to point `EMAIL_ENDPOINT` to `http://localhost:3000/api/bookings` (already done).
- Open the site in a browser and submit the booking form.
- Verify the confirmation arrives in the inbox and check logs via a SQLite viewer or programmatically.

## Security Notes

- Keep `.env` out of version control; store credentials securely.
- Apply provider-level rate limits and monitoring if deploying to production.
- Consider moving secrets to environment variables in your deployment (Vercel/Netlify/Render).