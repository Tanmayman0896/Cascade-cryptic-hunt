/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from 'next/headers'
import { isDbAvailable, db } from '@/db'
import { users, timelineProgress, puzzleEvents, fragments } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { timelines } from './timelines'
import crypto from 'crypto'

export interface SessionData {
  userId: string
  name: string
  email: string
  teamName?: string
  password?: string
  integrity: number
  recovered: string[] // List of timeline IDs that have recovered their fragment
  hints: number
  wrongAttempts: Record<string, number> // timelineId -> count of wrong answers
}

const DEFAULT_DEMO_STATE: SessionData = {
  userId: 'demo-agent-uuid',
  name: 'Demo Agent',
  email: 'agent@aetherion.org',
  teamName: 'Demo Team',
  password: 'password',
  integrity: 100,
  recovered: [],
  hints: 0,
  wrongAttempts: {},
}

import { signCookie, verifyCookie } from '@/lib/auth-session'

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false

  // Legacy plaintext password compatibility
  if (!storedHash.includes(':')) {
    return password === storedHash
  }

  const [salt, originalHash] = storedHash.split(':')
  if (!salt || !originalHash) return false

  const hashToVerify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(hashToVerify, 'hex'))
  } catch {
    return false
  }
}


export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const rawSessionId = cookieStore.get('auth_session')?.value
  const sessionId = rawSessionId ? await verifyCookie(rawSessionId) : null
  
  // Require auth cookie — do not auto-authenticate
  if (!sessionId) {
    return null
  }

  if (!isDbAvailable) {
    // Demo Mode: read state from cookie, or create a default session state
    const demoStateRawSigned = cookieStore.get('aetherion_demo_state')?.value
    const demoStateRaw = demoStateRawSigned ? await verifyCookie(demoStateRawSigned) : null
    if (demoStateRaw) {
      try {
        const parsed = JSON.parse(demoStateRaw) as SessionData
        return { ...parsed, userId: sessionId }
      } catch {
        return { ...DEFAULT_DEMO_STATE, userId: sessionId }
      }
    }
    return { ...DEFAULT_DEMO_STATE, userId: sessionId }
  }

  // Live Database Mode: query Drizzle ORM
  try {
    const userRows = await db.select().from(users).where(eq(users.id, sessionId)).limit(1)
    let user = userRows[0]
    
    if (!user) {
      if (sessionId === 'default-agent-uuid' && process.env.NODE_ENV === 'development') {
        // Auto-create default user in database (dev only check)
        await db.insert(users).values({
          id: sessionId,
          name: 'Demo Agent',
          email: 'agent@aetherion.org',
        })
        user = {
          id: sessionId,
          name: 'Demo Agent',
          email: 'agent@aetherion.org',
          createdAt: new Date(),
        }

        // Initialize progress entries if missing
        const progressList = await db.select().from(timelineProgress).where(eq(timelineProgress.userId, sessionId))
        if (progressList.length === 0) {
          const newEntries = timelines.map(t => ({
            userId: sessionId,
            timelineId: t.id,
            status: (t.id === 'operation-deadlight' ? 'active' : 'locked') as 'active' | 'locked',
            fragmentRecovered: false,
          }))
          await db.insert(timelineProgress).values(newEntries)
        }
      } else {
        return null
      }
    }

    // Get recovered fragments
    const recoveredRows = await db.select({ timelineId: fragments.timelineId }).from(fragments).where(eq(fragments.userId, sessionId))
    const recovered = recoveredRows.map((r: any) => r.timelineId)

    // Get wrong attempts to calculate integrity
    const events = await db.select({ timelineId: puzzleEvents.timelineId }).from(puzzleEvents).where(and(eq(puzzleEvents.userId, sessionId), eq(puzzleEvents.outcome, 'wrong')))
    
    const wrongAttempts: Record<string, number> = {}
    events.forEach((e: any) => {
      wrongAttempts[e.timelineId] = (wrongAttempts[e.timelineId] || 0) + 1
    })

    const hints = 0

    // Integrity score: starts at 100, drops by 10 per wrong answer (min 0)
    let totalWrong = 0
    Object.values(wrongAttempts).forEach(count => {
      totalWrong += count
    })
    const integrity = Math.max(0, 100 - totalWrong * 10)

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      teamName: user.teamName ?? undefined,
      integrity,
      recovered,
      hints,
      wrongAttempts,
    }
  } catch (error) {
    console.error('Database query error in getSession:', error)
    return null
  }
}

export async function setSession(name: string, email: string, teamName?: string, password?: string): Promise<string> {
  const cookieStore = await cookies()
  const newUserId = crypto.randomUUID()
  const isProd = process.env.NODE_ENV === 'production'
  const cookieOptions = { 
    path: '/', 
    httpOnly: true, 
    secure: isProd, 
    sameSite: 'lax' as const 
  }

  if (!isDbAvailable) {
    // Demo Mode: save dummy session and state cookies
    const newSessionState: SessionData = {
      ...DEFAULT_DEMO_STATE,
      userId: newUserId,
      name,
      email,
      teamName,
      password,
    }
    cookieStore.set('auth_session', await signCookie(newUserId), cookieOptions)
    cookieStore.set('aetherion_demo_state', await signCookie(JSON.stringify(newSessionState)), cookieOptions)
    return newUserId
  }

  // Live Database Mode
  try {
    // Check if user exists by email
    const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    let user = userRows[0]
    
    if (!user) {
      // Create user
      const hashedPassword = password ? (password.includes(':') ? password : hashPassword(password)) : null
      await db.insert(users).values({
        id: newUserId,
        name,
        email,
        teamName: teamName || null,
        password: hashedPassword,
      })
      user = { id: newUserId, name, email, teamName: teamName || null, password: hashedPassword, createdAt: new Date() }
    } else {
      // Verify password if user exists and a new plaintext password is supplied
      if (user.password && password && password !== user.password) {
        if (!verifyPassword(password, user.password)) {
          throw new Error('Incorrect password for this email address.')
        }
      }
      // Update user info if they log in again with new info
      const updates: Record<string, any> = { name }
      if (teamName) updates.teamName = teamName
      if (password && password !== user.password) {
        updates.password = password.includes(':') ? password : hashPassword(password)
      }
      await db.update(users).set(updates).where(eq(users.id, user.id))
      user = { ...user, ...updates }
    }

    // Initialize timeline progress for all 9 timelines
    const currentProgress = await db.select().from(timelineProgress).where(eq(timelineProgress.userId, user.id))
    const missingTimelines = timelines.filter(t => !currentProgress.some((p: any) => p.timelineId === t.id))

    if (missingTimelines.length > 0) {
      const newEntries = missingTimelines.map(t => ({
        userId: user.id,
        timelineId: t.id,
        status: (t.id === 'operation-deadlight' ? 'active' : 'locked') as 'active' | 'locked',
        fragmentRecovered: false,
      }))
      await db.insert(timelineProgress).values(newEntries)
    }

    cookieStore.set('auth_session', await signCookie(user.id), cookieOptions)
    return user.id
  } catch (error: any) {
    console.error('Database write error in setSession:', error)
    if (error.message === 'Incorrect password for this email address.') {
      throw error
    }
    // Fall back to cookie session if DB write fails
    cookieStore.set('auth_session', await signCookie(newUserId), cookieOptions)
    return newUserId
  }
}

export async function saveDemoState(state: SessionData) {
  const cookieStore = await cookies()
  const isProd = process.env.NODE_ENV === 'production'
  const cookieOptions = { 
    path: '/', 
    httpOnly: true, 
    secure: isProd, 
    sameSite: 'lax' as const 
  }
  cookieStore.set('aetherion_demo_state', await signCookie(JSON.stringify(state)), cookieOptions)
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_session')
  cookieStore.delete('aetherion_demo_state')
}
