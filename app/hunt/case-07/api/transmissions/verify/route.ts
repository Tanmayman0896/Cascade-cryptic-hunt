import { NextRequest, NextResponse } from 'next/server'
import { isDbAvailable, db } from '@/db'
import { emailTransmissions } from '@/db/schema'
import { mockTransmissions } from '@/app/hunt/case-07/lib/mockDb'
import { eq } from 'drizzle-orm'
import { getClientIp, isRateLimited, verifyCsrf } from '@/app/hunt/case-07/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF validation
    if (!verifyCsrf(request)) {
      return NextResponse.json({ success: false, message: 'CSRF validation failed.' }, { status: 403 })
    }

    // 2. IP-based rate limiting (Max 5 attempts per 10 minutes)
    const ip = getClientIp(request)
    if (isRateLimited(ip, 5, 10 * 60 * 1000, 'transmissions-verify')) {
      return NextResponse.json(
        { success: false, message: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid payload.' }, { status: 400 })
    }

    const { recoveryKey } = body as Record<string, unknown>
    if (typeof recoveryKey !== 'string' || !recoveryKey.trim()) {
      return NextResponse.json({ success: false, message: 'Recovery key is required.' }, { status: 400 })
    }

    const cleanedKey = recoveryKey.trim().toUpperCase()

    let record: any = null

    if (isDbAvailable) {
      try {
        const records = await db
          .select()
          .from(emailTransmissions)
          .where(eq(emailTransmissions.recoveryKey, cleanedKey))
        record = records[0]
      } catch (dbErr) {
        console.error('Database select error in verify route:', dbErr)
      }
    }

    if (!record) {
      record = Array.from(mockTransmissions.values()).find(
        t => t.recoveryKey === cleanedKey
      )
    }

    if (!record) {
      return NextResponse.json({ success: false, message: 'Invalid recovery key.' }, { status: 404 })
    }

    if (isDbAvailable) {
      try {
        await db
          .update(emailTransmissions)
          .set({
            isVerified: true,
            verifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailTransmissions.id, record.id))
      } catch (dbErr) {
        console.error('Database update error in verify route:', dbErr)
      }
    }

    mockTransmissions.set(record.id, {
      ...record,
      isVerified: true,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Verify API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    )
  }
}
