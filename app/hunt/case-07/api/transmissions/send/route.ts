import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isDbAvailable, db } from '@/db'
import { emailTransmissions } from '@/db/schema'
import { setSession, getSession } from '@/app/hunt/case-07/lib/session'
import { queueMailDeliveryJob } from '@/app/hunt/case-07/lib/brevo'
import { mockTransmissions, MockTransmission } from '@/app/hunt/case-07/lib/mockDb'
import { DeadlightTransmissionEmail } from '@/app/hunt/case-07/emails/case-07'
import { render } from '@react-email/components'
import React from 'react'
import { eq, and, gte } from 'drizzle-orm'
import crypto from 'crypto'
import { getClientIp, isRateLimited, verifyCsrf } from '@/app/hunt/case-07/lib/rateLimit'


const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.string().trim().email('Invalid email address.').toLowerCase(),
  sector: z.string().trim().min(1, 'Sector is required.'),
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF validation
    if (!verifyCsrf(request)) {
      return NextResponse.json({ success: false, message: 'CSRF validation failed.' }, { status: 403 })
    }

    // 2. IP-based rate limiting
    const ip = getClientIp(request)
    if (isRateLimited(ip, 5, 60 * 60 * 1000, 'transmissions-send')) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid payload.' }, { status: 400 })
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map(e => e.message).join(' ')
      return NextResponse.json({ success: false, message: errorMsg }, { status: 400 })
    }

    // Sanitize and escape inputs to prevent HTML injection
    const name = escapeHtml(parsed.data.name)
    const email = escapeHtml(parsed.data.email)
    const sector = escapeHtml(parsed.data.sector)

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Rate Limiting Check (Max 3 sends per email per hour)
    let isRateLimitedByDb = false
    if (isDbAvailable) {
      try {
        const recentSends = await db
          .select()
          .from(emailTransmissions)
          .where(
            and(
              eq(emailTransmissions.email, email),
              gte(emailTransmissions.sentAt, oneHourAgo)
            )
          )
        if (recentSends.length >= 3) {
          isRateLimitedByDb = true
        }
      } catch (dbErr) {
        console.error('Database query error in rate limit check:', dbErr)
        const mockRecent = Array.from(mockTransmissions.values()).filter(
          t => t.email === email && t.sentAt >= oneHourAgo
        )
        if (mockRecent.length >= 3) isRateLimitedByDb = true
      }
    } else {
      const mockRecent = Array.from(mockTransmissions.values()).filter(
        t => t.email === email && t.sentAt >= oneHourAgo
      )
      if (mockRecent.length >= 3) {
        isRateLimitedByDb = true
      }
    }

    if (isRateLimitedByDb) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded. Maximum 3 transmission requests per hour.' },
        { status: 429 }
      )
    }

    // Preserve existing teamName if active session exists
    const currentSession = await getSession().catch(() => null)
    const teamName = currentSession?.teamName

    // Set user session in cookies (log them in / sync session)
    const userId = await setSession(name, email, teamName).catch((err) => {
      console.error('setSession error in send route:', err)
      return crypto.randomUUID()
    })

    // Generate unique recovery key using CSPRNG
    let recoveryKey = ''
    let isUnique = false
    let attempts = 0

    while (!isUnique && attempts < 10) {
      attempts++
      const randomCode = crypto.randomBytes(2).toString('hex').toUpperCase() // e.g. "A2EF"
      recoveryKey = `NULL-PLAGAS-${randomCode}`

      if (isDbAvailable) {
        try {
          const existing = await db
            .select()
            .from(emailTransmissions)
            .where(eq(emailTransmissions.recoveryKey, recoveryKey))
          if (existing.length === 0) {
            isUnique = true
          }
        } catch (dbErr) {
          console.error('Database error checking recovery key uniqueness:', dbErr)
          const existing = Array.from(mockTransmissions.values()).find(
            t => t.recoveryKey === recoveryKey
          )
          if (!existing) isUnique = true
        }
      } else {
        const existing = Array.from(mockTransmissions.values()).find(
          t => t.recoveryKey === recoveryKey
        )
        if (!existing) {
          isUnique = true
        }
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { success: false, message: 'Cryptographic collision error. Please try again.' },
        { status: 500 }
      )
    }

    // Save transmission record (Drizzle or Mock)
    const transmissionId = crypto.randomUUID()
    const newRecord: MockTransmission = {
      id: transmissionId,
      name,
      email,
      sector,
      stageId: 2,
      answer: 'PLAGAS',
      recoveryKey,
      isVerified: false,
      sentAt: new Date(),
      verifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resendCount: 0,
      lastResentAt: null,
      deliveryStatus: 'queued',
      deliveryError: null,
    }

    if (isDbAvailable) {
      try {
        await db.insert(emailTransmissions).values({
          id: transmissionId,
          name,
          email,
          sector,
          stageId: 2,
          answer: 'PLAGAS',
          recoveryKey,
          isVerified: false,
          sentAt: newRecord.sentAt,
          createdAt: newRecord.createdAt,
          updatedAt: newRecord.updatedAt,
          deliveryStatus: 'queued',
          deliveryError: null,
        })
      } catch (dbErr) {
        console.error('Database insert error in transmissions/send:', dbErr)
      }
    }
    mockTransmissions.set(transmissionId, newRecord)

    // Compile email HTML & Text
    let emailHtml = ''
    try {
      const emailElement = React.createElement(DeadlightTransmissionEmail, {
        name,
        sector,
        recoveryKey,
      })
      emailHtml = await render(emailElement)
    } catch (renderErr) {
      console.error('Failed to render React Email element:', renderErr)
    }
    const emailText = `
PROJECT NULL // INTERCEPTED DATA PACKETS // SITE KENNEDY
----------------------------------------------------------------------
RECOVERY AGENT: ${name.toUpperCase()} — SECTOR: ${sector.toUpperCase()}

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

    // Queue background delivery job asynchronously without awaiting
    queueMailDeliveryJob({
      transmissionId,
      to: email,
      subject: '[CLASSIFIED] Recovered Transmission — Site Kennedy',
      html: emailHtml,
      text: emailText,
      db,
      isDbAvailable,
      emailTransmissions,
      mockTransmissions,
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Transmission send API exception:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    )
  }
}
