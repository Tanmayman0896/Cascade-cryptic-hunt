import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSession, saveDemoState } from '@/app/hunt/case-07/lib/session'
import { isDbAvailable, db } from '@/db'
import { puzzleEvents, caseQuestions } from '@/db/schema'
import { timelines } from '@/app/hunt/case-07/lib/timelines'
import { verifyCsrf } from '@/app/hunt/case-07/lib/rateLimit'
import { and, eq } from 'drizzle-orm'

const allowedPuzzles = new Set([
  'quarantine-registration',
  'behavioral-match',
  'black-symbol',
  'identity-distortion',
  'memory-corruption',
  'final-transmission',
])

const FALLBACK_ANSWERS: Record<string, string> = {
  'quarantine-registration': 'PLAGAS',
  'behavioral-match': 'LURE',
  'black-symbol': 'REPLACE',
  'identity-distortion': 'INFILTRATE',
  'memory-corruption': 'OUTBREAK',
  'final-transmission': 'AETHERION',
}

function digest(value: string) {
  return createHash('sha256').update(value.trim().toUpperCase()).digest()
}

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF validation
    if (!verifyCsrf(request)) {
      return NextResponse.json({ correct: false, message: 'CSRF validation failed.' }, { status: 403 })
    }

    let session = await getSession()
    if (!session && !isDbAvailable) {
      session = {
        userId: 'demo-agent-uuid',
        name: 'Demo Agent',
        email: 'agent@aetherion.org',
        teamName: 'Demo Team',
        integrity: 100,
        recovered: [],
        hints: 0,
        wrongAttempts: {},
      }
    }

    if (!session) {
      return NextResponse.json({ correct: false, message: 'Unauthenticated.' }, { status: 401 })
    }

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ correct: false, message: 'Invalid request.' }, { status: 400 })
    }

    const { timelineId, puzzleId, answer } = body as Record<string, unknown>
    const validTimelineIds = new Set(timelines.map(t => t.id))
    if (typeof timelineId !== 'string' || !validTimelineIds.has(timelineId) || typeof puzzleId !== 'string' || !allowedPuzzles.has(puzzleId) || typeof answer !== 'string') {
      return NextResponse.json({ correct: false, message: 'Invalid puzzle parameters.' }, { status: 400 })
    }

    // Determine expected answer: check DB first, fall back to env key, then fallback dictionary
    let expected = ""
    if (isDbAvailable) {
      try {
        const rows = await db.select().from(caseQuestions).where(
          and(
            eq(caseQuestions.caseId, "07"),
            eq(caseQuestions.puzzleKey, puzzleId)
          )
        )
        if (rows.length > 0) {
          expected = rows[0].answer
        }
      } catch (dbError) {
        console.error("Failed to fetch Case 7 answer from DB:", dbError)
      }
    }

    if (!expected) {
      const envKey = `PUZZLE_OPERATION_DEADLIGHT_${puzzleId.replaceAll('-', '_').toUpperCase()}`
      expected = process.env[envKey] || FALLBACK_ANSWERS[puzzleId] || ""
    }

    if (!expected) {
      console.error(`Missing expected answer in DB and process.env for key: ${puzzleId}`)
      return NextResponse.json({ correct: false, message: 'Configuration error: answer key not configured.' }, { status: 500 })
    }

    const correct = timingSafeEqual(digest(answer), digest(expected))
    const outcome = correct ? ('correct' as const) : ('wrong' as const)

    // Append-only audit log
    if (isDbAvailable) {
      try {
        await db.insert(puzzleEvents).values({
          userId: session.userId,
          timelineId: timelineId,
          puzzleId: puzzleId,
          answerHash: createHash('sha256').update(answer.trim().toUpperCase()).digest('hex'),
          outcome: outcome,
        })
      } catch (dbError) {
        console.error('Failed to write puzzle event to database:', dbError)
      }
    } else {
      // Demo Mode: save wrong attempts in session cookie to degrade integrity dynamically
      if (!correct) {
        session.wrongAttempts[timelineId] = (session.wrongAttempts[timelineId] || 0) + 1
        session.integrity = Math.max(0, session.integrity - 10)
      }
      await saveDemoState(session)
    }

    return NextResponse.json({ correct })
  } catch (error) {
    console.error('Validation API error:', error)
    return NextResponse.json({ correct: false, message: 'Internal server error.' }, { status: 500 })
  }
}
