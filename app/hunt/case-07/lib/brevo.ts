import fs from 'fs'
import path from 'path'

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
}

function parseEmailFrom(emailFrom: string): { name?: string; email: string } {
  const match = emailFrom.match(/^(.*?)\s*<(.*?)>$/)
  if (match) {
    return {
      name: match[1].trim() || undefined,
      email: match[2].trim(),
    }
  }
  return {
    email: emailFrom.trim(),
  }
}

export async function sendClassifiedEmail({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string; method: 'brevo' | 'local_log' }> {
  const from = process.env.EMAIL_FROM || 'PROJECT NULL <onboarding@brevo.com>'
  const apiKey = process.env.BREVO_API_KEY

  // If Brevo API key is configured, use it
  if (apiKey) {
    try {
      const parsedSender = parseEmailFrom(from)
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: parsedSender,
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Brevo delivery failed:', errorText)
        return { success: false, error: errorText, method: 'brevo' }
      }

      const responseData = await response.json().catch(() => ({}))
      return { success: true, id: responseData.messageId, method: 'brevo' }
    } catch (err: any) {
      console.error('Exception during Brevo transmission:', err)
      return { success: false, error: err.message || String(err), method: 'brevo' }
    }
  }

  // Fallback: Local log writing for offline / demo mode
  try {
    const logEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${to}
FROM: ${from}
SUBJECT: ${subject}
----------------------------------------
[HTML CONTENT]:
${html}

[TEXT CONTENT]:
${text}
========================================
\n`
    if (process.env.VERCEL) {
      console.log('\n[VERCEL EMAIL SIMULATOR] Email dispatch simulated:\n', logEntry)
      return { success: true, id: 'simulated-brevo-id-' + Math.random().toString(36).substr(2, 9), method: 'local_log' }
    }

    const logDir = path.join(process.cwd(), 'artifacts')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    const logFilePath = path.join(logDir, 'sent_emails.log')
    fs.appendFileSync(logFilePath, logEntry, 'utf-8')
    console.log('\n[LOCAL EMAIL SIMULATOR] Email logged to artifacts/sent_emails.log:\n', logEntry)
    
    return { success: true, id: 'simulated-brevo-id-' + Math.random().toString(36).substr(2, 9), method: 'local_log' }
  } catch (err: any) {
    console.error('Failed to log email to local artifacts:', err)
    return { success: true, id: 'simulated-brevo-id-' + Math.random().toString(36).substr(2, 9), method: 'local_log' }
  }
}

export function queueMailDeliveryJob({
  transmissionId,
  to,
  subject,
  html,
  text,
  db,
  isDbAvailable,
  emailTransmissions,
  mockTransmissions,
  extraUpdates = {},
}: {
  transmissionId: string
  to: string
  subject: string
  html: string
  text: string
  db: any
  isDbAvailable: boolean
  emailTransmissions: any
  mockTransmissions: Map<string, any>
  extraUpdates?: Record<string, any>
}) {
  // Fire and forget asynchronous mail delivery job
  Promise.resolve().then(async () => {
    try {
      const delivery = await sendClassifiedEmail({ to, subject, html, text })

      const updatePayload = {
        ...extraUpdates,
        deliveryStatus: delivery.success ? 'success' : 'failed',
        deliveryError: delivery.error || null,
        updatedAt: new Date(),
      }

      if (isDbAvailable) {
        const { eq } = await import('drizzle-orm')
        await db
          .update(emailTransmissions)
          .set(updatePayload)
          .where(eq(emailTransmissions.id, transmissionId))
      } else {
        const record = mockTransmissions.get(transmissionId)
        if (record) {
          mockTransmissions.set(transmissionId, {
            ...record,
            ...updatePayload,
          })
        }
      }

      if (!delivery.success) {
        console.error(`[MailQueue] Delivery failed for transmission ${transmissionId}:`, delivery.error)
      }
    } catch (err: any) {
      console.error(`[MailQueue] Execution exception for transmission ${transmissionId}:`, err)
      const errorPayload = {
        ...extraUpdates,
        deliveryStatus: 'failed',
        deliveryError: err.message || String(err),
        updatedAt: new Date(),
      }
      if (isDbAvailable) {
        try {
          const { eq } = await import('drizzle-orm')
          await db
            .update(emailTransmissions)
            .set(errorPayload)
            .where(eq(emailTransmissions.id, transmissionId))
        } catch (dbErr) {
          console.error('[MailQueue] Failed to save error status to DB:', dbErr)
        }
      } else {
        const record = mockTransmissions.get(transmissionId)
        if (record) {
          mockTransmissions.set(transmissionId, {
            ...record,
            ...errorPayload,
          })
        }
      }
    }
  })
}

