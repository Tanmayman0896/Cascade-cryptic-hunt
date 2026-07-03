import { NextRequest, NextResponse } from 'next/server'
import { db, isDbAvailable } from '@/db'
import { caseQuestions } from '@/db/schema'
import { eq, and, or } from 'drizzle-orm'

function normalize(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_FUZZY_STRING_LENGTH = 300;
const similarityCache = new Map<string, number>();
const MAX_CACHE_SIZE = 500;

// Sliding window rate limiter to prevent brute-force ReDoS / CPU exhaustion
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_POST_REQUESTS_PER_WINDOW = 30; // 30 attempts per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_POST_REQUESTS_PER_WINDOW) {
    return true;
  }
  entry.count++;
  return false;
}

// Optimized 1D Levenshtein distance algorithm (O(min(M,N)) memory)
function getLevenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  // Cap string length to prevent CPU exhaustion on extremely long inputs
  if (s1.length > MAX_FUZZY_STRING_LENGTH) s1 = s1.slice(0, MAX_FUZZY_STRING_LENGTH);
  if (s2.length > MAX_FUZZY_STRING_LENGTH) s2 = s2.slice(0, MAX_FUZZY_STRING_LENGTH);

  // Ensure s1 is shorter to minimize Int32Array size
  if (s1.length > s2.length) {
    const tmpStr = s1;
    s1 = s2;
    s2 = tmpStr;
  }

  const len1 = s1.length;
  const len2 = s2.length;

  let prev = new Int32Array(len1 + 1);
  let curr = new Int32Array(len1 + 1);

  for (let i = 0; i <= len1; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= len2; j++) {
    curr[0] = j;
    const char2 = s2.charCodeAt(j - 1);
    for (let i = 1; i <= len1; i++) {
      const cost = s1.charCodeAt(i - 1) === char2 ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,       // deletion
        curr[i - 1] + 1,   // insertion
        prev[i - 1] + cost // substitution
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[len1];
}

function getSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  
  const cacheKey = s1 < s2 ? `${s1}:${s2}` : `${s2}:${s1}`;
  const cached = similarityCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = getLevenshteinDistance(s1, s2);
  const similarity = 1 - dist / maxLen;

  if (similarityCache.size >= MAX_CACHE_SIZE) {
    const firstKey = similarityCache.keys().next().value;
    if (firstKey) similarityCache.delete(firstKey);
  }
  similarityCache.set(cacheKey, similarity);
  return similarity;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const caseId = searchParams.get('caseId')
  const puzzleKey = searchParams.get('puzzleKey')
  const limitParam = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 100)
  const offsetParam = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

  if (!caseId) {
    return NextResponse.json({ success: false, error: 'caseId parameter required' }, { status: 400 })
  }

  if (!isDbAvailable) {
    return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
  }

  try {
    const whereConditions = puzzleKey
      ? and(eq(caseQuestions.caseId, caseId), eq(caseQuestions.puzzleKey, puzzleKey))
      : eq(caseQuestions.caseId, caseId)

    const rows = await db.select({
      id: caseQuestions.id,
      caseId: caseQuestions.caseId,
      puzzleKey: caseQuestions.puzzleKey,
      question: caseQuestions.question
    })
    .from(caseQuestions)
    .where(whereConditions)
    .limit(limitParam)
    .offset(offsetParam)

    return NextResponse.json({ success: true, questions: rows })
  } catch (error) {
    console.error(`Failed to get Case ${caseId} questions:`, error)
    return NextResponse.json({ success: false, error: 'Database read error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isDbAvailable) {
    return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { caseId, puzzleKey, answer } = body

    if (!caseId || !puzzleKey || typeof answer !== 'string' || answer.length > 500) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 })
    }

    const isUiPuzzle = caseId === '01' || caseId === '02';
    if (!isUiPuzzle) {
      const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
      if (checkRateLimit(clientIp)) {
        return NextResponse.json(
          { success: false, error: 'Too many answer attempts. Please wait a minute.' },
          { status: 429 }
        );
      }
    }

    const normalizedKey = puzzleKey.replaceAll("-", "_");

    const rows = await db.select({
      answer: caseQuestions.answer
    }).from(caseQuestions).where(
      and(
        eq(caseQuestions.caseId, caseId),
        or(
          eq(caseQuestions.puzzleKey, puzzleKey),
          eq(caseQuestions.puzzleKey, normalizedKey)
        )
      )
    )

    if (rows.length === 0) {
      return NextResponse.json({ success: true, correct: false, message: 'Question not found' })
    }

    const dbAnswer = rows[0].answer
    const normDb = normalize(dbAnswer)
    const normUser = normalize(answer)

    let correct = normDb === normUser
    let partial = false

    const aliases: string[] = []
    let fuzzyThreshold = 1.0

    if (normalizedKey === 'stage7') {
      aliases.push('null7', 'null-7', 'null 7')
    } else if (normalizedKey === 'wilhelm_scream') {
      aliases.push('wilhelm', 'private wilhelm', 'the wilhelm scream', 'wilhelm scream')
    } else if (normalizedKey === 'poe_cipher') {
      aliases.push('gil bronza', 'gil broza')
      fuzzyThreshold = 0.8
    } else if (normalizedKey === 'deep_blue') {
      aliases.push('kasparov')
      fuzzyThreshold = 0.8
    } else if (normalizedKey === 'kryptos_cipher') {
      fuzzyThreshold = 0.9
    } else if (normalizedKey === 'mirror_script') {
      aliases.push('carnival 17', 'carnival17', 'reveal')
    } else if (normalizedKey === 'golden_record') {
      fuzzyThreshold = 0.8
    } else if (normalizedKey === 'chronicle_sort') {
      aliases.push(
        'hwtoll', 
        'awwstl', 
        'llotwh', 
        'ltswwa', 
        '0,1,2,3,4,5', 
        '012345',
        'light leads only the worthy home',
        'emoh yhtrow eht ylno sdael thgil'
      )
    } else if (normalizedKey === 'audio_game') {
      aliases.push('crimson', 'resonance')
    }

    // Special Case 8 handling
    if (caseId === '08') {
      if (normalizedKey === 'p1' || normalizedKey === 'dossier_1') {
        aliases.push('14 october 1972', '14-oct-1972', '14 oct 1972', 'october 14 1972', '14/10/1972', '14-10-1972')
      } else if (normalizedKey === 'p5' || normalizedKey === 'dossier_5') {
        aliases.push('the null room', 'null room')
      } else if (normalizedKey === 'p6' || normalizedKey === 'dossier_6') {
        aliases.push('null-gate', 'null gate', 'nullgate')
      }
    }

    const normAliases = aliases.map(normalize)

    if (!correct) {
      if (normAliases.includes(normUser)) {
        correct = true
      }
    }

    if (!correct && fuzzyThreshold < 1.0) {
      if (getSimilarity(normDb, normUser) >= fuzzyThreshold) {
        correct = true
      }
      for (const normAlias of normAliases) {
        if (getSimilarity(normAlias, normUser) >= fuzzyThreshold) {
          correct = true
        }
      }
    }

    // Partial credit check
    if (!correct && normUser.length >= 3) {
      const isSubstringOfCanonical = normDb.includes(normUser)
      const isSubstringOfAnyAlias = normAliases.some(alias => alias.includes(normUser))
      if (isSubstringOfCanonical || isSubstringOfAnyAlias) {
        partial = true
      }
    }

    return NextResponse.json({ success: true, correct, partial })
  } catch (error) {
    console.error('Failed to validate question:', error)
    return NextResponse.json({ success: false, error: 'Database verification error' }, { status: 500 })
  }
}
