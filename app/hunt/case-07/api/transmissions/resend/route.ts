import { NextRequest, NextResponse } from 'next/server'
import { isDbAvailable, db } from '@/db'
import { emailTransmissions } from '@/db/schema'
import { mockTransmissions } from '@/app/hunt/case-07/lib/mockDb'
import { queueMailDeliveryJob } from '@/app/hunt/case-07/lib/brevo'
import { DeadlightTransmissionEmail } from '@/app/hunt/case-07/emails/case-07'
import { render } from '@react-email/components'
import React from 'react'
import { eq, desc } from 'drizzle-orm'
import { getSession, saveDemoState } from '@/app/hunt/case-07/lib/session'
import { getClientIp, isRateLimited, verifyCsrf } from '@/app/hunt/case-07/lib/rateLimit'


export async function POST(request: NextRequest) {
  try {
    // 1. CSRF validation
    if (!verifyCsrf(request)) {
      return NextResponse.json({ success: false, message: 'CSRF validation failed.' }, { status: 403 })
    }

    // 2. IP-based rate limiting (Max 3 resends per hour)
    const ip = getClientIp(request)
    if (isRateLimited(ip, 3, 60 * 60 * 1000, 'transmissions-resend')) {
      return NextResponse.json(
        { success: false, message: 'Too many resend attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid payload.' }, { status: 400 })
    }

    const { email } = body as Record<string, unknown>
    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, message: 'Email address is required.' }, { status: 400 })
    }

    const cleanedEmail = email.trim().toLowerCase()

    // 3. Authenticate and enforce session-to-email ownership
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Active session not found.' },
        { status: 401 }
      )
    }

    if (session.email.toLowerCase() !== cleanedEmail) {
      if (!isDbAvailable && session.email === 'agent@aetherion.org') {
        session.email = cleanedEmail
        await saveDemoState(session)
      } else {
        return NextResponse.json(
          { success: false, message: 'Unauthorized. Active session does not match requested email.' },
          { status: 401 }
        )
      }
    }

    let record: any = null

    if (isDbAvailable) {
      try {
        const records = await db
          .select()
          .from(emailTransmissions)
          .where(eq(emailTransmissions.email, cleanedEmail))
          .orderBy(desc(emailTransmissions.sentAt))
          .limit(1)
        record = records[0]
      } catch (dbErr) {
        console.error('Database query error in resend route:', dbErr)
      }
    }

    if (!record) {
      const mockRecords = Array.from(mockTransmissions.values())
        .filter(t => t.email === cleanedEmail)
        .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      record = mockRecords[0]
    }

    if (!record) {
      return NextResponse.json(
        { success: false, message: 'No active transmission registration found for this email address.' },
        { status: 404 }
      )
    }

    // Cooldown verification (60 seconds)
    const lastSentTime = record.lastResentAt ? new Date(record.lastResentAt).getTime() : new Date(record.sentAt).getTime()
    const elapsedSeconds = (Date.now() - lastSentTime) / 1000

    if (elapsedSeconds < 60) {
      const waitTime = Math.ceil(60 - elapsedSeconds)
      return NextResponse.json(
        { success: false, message: `Please wait ${waitTime} seconds before requesting a resend.` },
        { status: 429 }
      )
    }

    // Limit check (Maximum 3 resends)
    if (record.resendCount >= 3) {
      return NextResponse.json(
        { success: false, message: 'Maximum limit of 3 resends has been reached for this transmission.' },
        { status: 400 }
      )
    }

    const nextResendCount = record.resendCount + 1
    const lastResentAt = new Date()

    // Render email template
    let emailHtml = ''
    try {
      const emailElement = React.createElement(DeadlightTransmissionEmail, {
        name: record.name,
        sector: record.sector,
        recoveryKey: record.recoveryKey,
      })
      emailHtml = await render(emailElement)
    } catch (renderErr) {
      console.error('Failed to render React Email template in resend route:', renderErr)
    }

    const emailText = `
PROJECT NULL // INTERCEPTED DATA PACKETS // SITE KENNEDY (RESEND)
----------------------------------------------------------------------
RECOVERY AGENT: ${record.name.toUpperCase()} — SECTOR: ${record.sector.toUpperCase()}

6 encoded data packets were intercepted from the organism's neural 
network. Each packet uses a different encoding method and contains a 
single number.

STEP 1: Decode each packet to its decimal value.
STEP 2: Map each decimal to its position in the alphabet (1=A, 2=B, ... 26=Z).
STEP 3: Compile the 6 letters in order to form the classification code.

----------------------------------------------------------------------

PACKET 1 — BINARY ENCODING (Base-2)
Data: 00010000
Method: Standard 8-bit unsigned binary.
Each bit position represents a power of 2: (128, 64, 32, 16, 8, 4, 2, 1).
Add up the positions where a '1' appears.

PACKET 2 — HEXADECIMAL ENCODING (Base-16)
Data: 0x0C
Method: Base-16 number system. 
Digits: 0-9 then A=10, B=11, C=12, D=13, E=14, F=15.
Convert to decimal.

PACKET 3 — OCTAL ENCODING (Base-8)
Data: 01
Method: Base-8 number system.
Each digit represents a power of 8. Convert to decimal.

PACKET 4 — BASE64 ENCODING
Data: Bw==
Method: Base64 decodes to raw bytes. 
Decode "Bw==" to get a single byte. The byte's decimal value is your number.
Technical hint: 'B' in Base64 = index 1, 'w' = index 48. Combined: (1 << 2) | (48 >> 4) = 7.

PACKET 5 — ASCII ARITHMETIC
Data: chr(66) - chr(65)
Method: ASCII character code subtraction.
Look up the ASCII decimal values of the characters, then subtract.
'A' = 65, 'B' = 66, 'C' = 67, etc.

PACKET 6 — BINARY XOR OPERATION
Data: 11001 XOR 01010
Method: Perform bitwise XOR on the two 5-bit binary numbers, 
then convert the result to decimal.
XOR rule: same bits = 0, different bits = 1.

----------------------------------------------------------------------
REFERENCE TABLE: 
A=1  B=2  C=3  D=4  E=5  F=6  G=7  H=8  I=9  J=10 K=11 L=12 M=13
N=14 O=15 P=16 Q=17 R=18 S=19 T=20 U=21 V=22 W=23 X=24 Y=25 Z=26
----------------------------------------------------------------------

	Upon proper reconstruction, investigators established the decryption validation key format:
	XXXX-[DECODED_CODE]-XXXX
	
	Replace [DECODED_CODE] with the 6-letter classification code you deciphered from the 6 data packets above to form the final validation key (e.g., XXXX-XXXXXX-XXXX).

⚠ DO NOT SHARE THIS KEY. ALL VALIDATION ATTEMPTS ARE LOGGED SERVER-SIDE AND TRACED TO AGENT CREDENTIALS.
PROJECT NULL // SITE KENNEDY COMMAND HQ // 1996
`

    // Update resend tracking info immediately to queued state
    if (isDbAvailable) {
      try {
        await db
          .update(emailTransmissions)
          .set({
            resendCount: nextResendCount,
            lastResentAt,
            deliveryStatus: 'queued',
            deliveryError: null,
            updatedAt: new Date(),
          })
          .where(eq(emailTransmissions.id, record.id))
      } catch (dbErr) {
        console.error('Database update error in resend route:', dbErr)
      }
    }

    mockTransmissions.set(record.id, {
      ...record,
      resendCount: nextResendCount,
      lastResentAt,
      deliveryStatus: 'queued',
      deliveryError: null,
      updatedAt: new Date(),
    })

    // Queue background delivery job asynchronously without awaiting
    queueMailDeliveryJob({
      transmissionId: record.id,
      to: record.email,
      subject: '[CLASSIFIED] Recovered Transmission — Site Kennedy (Resend)',
      html: emailHtml,
      text: emailText,
      db,
      isDbAvailable,
      emailTransmissions,
      mockTransmissions,
      extraUpdates: {
        resendCount: nextResendCount,
        lastResentAt,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {

    console.error('Transmission resend API exception:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    )
  }
}
