'use client'

import { FormEvent, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageCurl } from '@/components/case-07/puzzle/PageCurl'

interface PuzzleInputProps {
  puzzleId: string
  timelineId?: string
  onCorrect: () => void
  onWrong?: (attempt: string) => void
  placeholder?: string
  maxLength?: number
  theme?: 'parchment' | 'terminal' | 'dossier'
}

type ValidationResponse = { correct: boolean; message?: string }

const pageBackgrounds: Record<NonNullable<PuzzleInputProps['theme']>, string> = {
  parchment: '#e9d8ae',
  dossier: '#e9d8ae',
  terminal: '#0b0b09',
}

export function PuzzleInput({
  puzzleId,
  timelineId = 'operation-deadlight',
  onCorrect,
  onWrong,
  placeholder = 'Enter recovery key',
  maxLength = 32,
  theme = 'terminal',
}: PuzzleInputProps) {
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState<'idle' | 'wrong' | 'loading' | 'correct' | 'error'>('idle')
  const [showCurl, setShowCurl] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const attempt = answer.trim()
    if (!attempt || status === 'loading' || status === 'correct') return
    setStatus('loading')
    try {
      const response = await fetch('/hunt/case-07/api/puzzle/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelineId, puzzleId, answer: attempt }),
      })
      const payload = (await response.json()) as ValidationResponse
      if (response.ok && payload.correct) {
        setStatus('correct')
        setShowCurl(true)
        return
      }
      if (!response.ok) {
        setStatus('error')
        return
      }
      setStatus('wrong')
      onWrong?.(attempt)
    } catch {
      setStatus('error')
    }
  }

  return (
    <motion.form
      className={`aetherion-puzzle aetherion-puzzle--${theme} ${status === 'wrong' ? 'aetherion-puzzle--wrong' : ''}`}
      onSubmit={submit}
      style={{ position: 'relative' }}
      animate={status === 'wrong' ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <label htmlFor={`puzzle-${puzzleId}`}>Recovery key</label>
      <div>
        <input
          id={`puzzle-${puzzleId}`}
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value)
            if (status === 'wrong' || status === 'error') setStatus('idle')
          }}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck="false"
          placeholder={placeholder}
          disabled={status === 'correct'}
        />
        <button type="submit" disabled={status === 'loading' || status === 'correct'}>
          {status === 'loading' ? 'Checking…' : status === 'correct' ? 'Cleared' : 'Submit'}
        </button>
      </div>
      <div aria-live="polite" style={{ minHeight: '24px', marginTop: '0.5rem' }}>
        <AnimatePresence mode="wait">
          {status !== 'idle' && status !== 'loading' && (
            <motion.p
              key={status}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.2 }}
            >
              {status === 'wrong'
                ? 'Key rejected. Timeline integrity has been affected.'
                : status === 'error'
                  ? 'Validation link unavailable. Please try again.'
                  : status === 'correct'
                    ? '✦ GATE CLEARED. YOU CAN NOW MOVE FORWARD (SCROLL DOWN).'
                    : ''}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <PageCurl
        solved={showCurl}
        flipPage={false}
        pageBackground={pageBackgrounds[theme]}
        onCurlComplete={onCorrect}
      />
    </motion.form>
  )
}
