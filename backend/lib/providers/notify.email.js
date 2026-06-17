// Email notification channel (SMTP via nodemailer). Same NotifyChannel interface as
// the in-app channel. Deploy-only: real sends require SMTP credentials and outbound
// network, which the dev sandbox blocks. No-ops (logs) when SMTP isn't configured.
import nodemailer from 'nodemailer'

export const id = 'email'

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, ALERT_EMAIL_TO } = process.env

export const isConfigured = () => Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && ALERT_EMAIL_TO)

let transporter = null
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  }
  return transporter
}

export async function send({ title, body }) {
  if (!isConfigured()) {
    console.warn('[stocker] email channel skipped — SMTP not configured')
    return { ok: false, channel: 'email', skipped: true }
  }
  await getTransporter().sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: ALERT_EMAIL_TO,
    subject: `📈 Stocker alert: ${title}`,
    text: body ? `${title}\n\n${body}` : title,
  })
  return { ok: true, channel: 'email' }
}
