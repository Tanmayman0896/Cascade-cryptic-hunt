'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'
import styles from '../operation-deadlight.module.css'

interface Alert {
  id: string
  sector: string
  message: string
  row: number
  col: number
  type: 'standard' | 'coded' | 'critical'
  scrambled?: string
  solution?: string
}

const WAVE_CONFIG = [
  { duration: 600, spawnRate: 1400, maxAlerts: 6, target: 20, label: 'INITIAL BREACH' },
  { duration: 600, spawnRate: 1000, maxAlerts: 9, target: 25, label: 'CASCADE FAILURE' },
  { duration: 600, spawnRate: 800, maxAlerts: 12, target: 30, label: 'FINAL COLLAPSE' },
]

const SECTORS = [
  'SECTOR 7-C', 'SECTOR 12-A', 'SECTOR 3-D', 'SECTOR 9-B', 'SECTOR 15-F',
  'SECTOR 2-E', 'SECTOR 8-A', 'SECTOR 11-C', 'SECTOR 4-B', 'COMMAND HQ',
]

const MESSAGES_BY_WAVE: Record<number, string[]> = {
  0: [
    'Organism spread detected. Personnel unresponsive.',
    'Biometric scanner offline. Manual check required.',
    'Subject failed identification protocol.',
    'Communications in sector degraded.',
    'Resident behavioral anomaly flagged.',
    'Security lock disengaged — origin unknown.',
  ],
  1: [
    'SUBJECTS UNACCOUNTED. LAST KNOWN LOCATION UNKNOWN.',
    'BREACH DETECTED IN COMMAND SECTOR.',
    'ORGANISM DETECTED OUTSIDE CONTAINMENT ZONE.',
    'PERSONNEL MISSING — THIRD INCIDENT TODAY.',
    'FOOTAGE CORRUPTION IN SECURITY ARRAY.',
    'IDENTITY VERIFICATION SYSTEM COMPROMISED.',
  ],
  2: [
    'IT IS INSIDE THE WALLS.',
    'WE CANNOT DETERMINE WHO IS INFECTED.',
    'EVACUATION ROUTE BLOCKED — CAUSE UNKNOWN.',
    'SITE KENNEDY — TOTAL LOSS.',
    '"None of us remember arriving here."',
    'ALL PERSONNEL — STATUS UNKNOWN.',
  ],
}

const THEMATIC_WORDS = ['BIOWEAPON', 'CONTAINMENT', 'INFECTED', 'MUTATION', 'PATHOGEN', 'QUARANTINE', 'INTEGRITY']

function scramble(word: string): string {
  const arr = word.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  const scrambled = arr.join('')
  if (scrambled === word) return scramble(word)
  return scrambled
}

function generateMathProblem(): { problem: string, answer: string } {
  const type = Math.floor(Math.random() * 3)
  let problem = '', answer = ''
  if (type === 0) { // (a + b) * c
    const a = Math.floor(Math.random() * 8) + 3
    const b = Math.floor(Math.random() * 8) + 3
    const c = Math.floor(Math.random() * 4) + 2
    problem = `(${a} + ${b}) × ${c} = ?`
    answer = String((a + b) * c)
  } else if (type === 1) { // a - b * c
    const b = Math.floor(Math.random() * 5) + 2
    const c = Math.floor(Math.random() * 5) + 2
    const a = Math.floor(Math.random() * 30) + (b * c + 5)
    problem = `${a} - ${b} × ${c} = ?`
    answer = String(a - b * c)
  } else { // a * b + c
    const a = Math.floor(Math.random() * 6) + 3
    const b = Math.floor(Math.random() * 6) + 3
    const c = Math.floor(Math.random() * 11) + 5
    problem = `${a} × ${b} + ${c} = ?`
    answer = String(a * b + c)
  }
  return { problem, answer }
}

export function AlertElimination({ onSolved }: { onSolved: () => void }) {
  const [wave, setWave] = useState(0)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [timeLeft, setTimeLeft] = useState(WAVE_CONFIG[0].duration)
  const [cleared, setCleared] = useState(0)
  const [status, setStatus] = useState<'active' | 'interlude' | 'failed' | 'complete'>('active')
  const [interludeId, setInterludeId] = useState<1 | 2>(1)
  const [totalCleared, setTotalCleared] = useState(0)

  // Interlude state
  const [interludeInput, setInterludeInput] = useState('')
  const [interludeCooldown, setInterludeCooldown] = useState(0)
  const [interludeError, setInterludeError] = useState('')

  // Alert inputs state
  const [alertInputs, setAlertInputs] = useState<Record<string, string>>({})

  const spawnIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const interludeTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const alertIdCounter = useRef(0)

  const spawnAlert = useCallback(() => {
    const config = WAVE_CONFIG[wave]
    setAlerts(prev => {
      if (prev.length >= config.maxAlerts) return prev

      const occupied = new Set(prev.map(a => `${a.row}-${a.col}`))
      const freeCells: { row: number, col: number }[] = []
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
          const key = `${r}-${c}`
          if (!occupied.has(key)) {
            freeCells.push({ row: r, col: c })
          }
        }
      }

      if (freeCells.length === 0) return prev
      const cell = freeCells[Math.floor(Math.random() * freeCells.length)]
      const { row, col } = cell

      const msgs = MESSAGES_BY_WAVE[wave] ?? MESSAGES_BY_WAVE[0]
      alertIdCounter.current++

      // Determine alert type based on wave
      let type: 'standard' | 'coded' | 'critical' = 'standard'
      let scrambled: string | undefined = undefined
      let solution: string | undefined = undefined

      if (wave === 1) {
        // Wave 2 has standard and coded alerts
        if (Math.random() < 0.45) {
          type = 'coded'
          const word = THEMATIC_WORDS[Math.floor(Math.random() * THEMATIC_WORDS.length)]
          scrambled = scramble(word)
          solution = word
        }
      } else if (wave === 2) {
        // Wave 3 has standard, coded, and critical (math) alerts
        const rand = Math.random()
        if (rand < 0.35) {
          type = 'critical'
          const math = generateMathProblem()
          scrambled = math.problem
          solution = math.answer
        } else if (rand < 0.7) {
          type = 'coded'
          const word = THEMATIC_WORDS[Math.floor(Math.random() * THEMATIC_WORDS.length)]
          scrambled = scramble(word)
          solution = word
        }
      }

      return [...prev, {
        id: `alert-${alertIdCounter.current}`,
        sector: SECTORS[Math.floor(Math.random() * SECTORS.length)],
        message: msgs[Math.floor(Math.random() * msgs.length)],
        row,
        col,
        type,
        scrambled,
        solution,
      }]
    })
  }, [wave])

  const dismissAlert = useCallback((alertId: string) => {
    // GSAP dismiss animation
    const el = document.getElementById(alertId)
    if (el) {
      gsap.to(el, {
        scale: 0.8, opacity: 0, duration: 0.25, ease: 'power2.in',
        onComplete: () => {
          setAlerts(prev => prev.filter(a => a.id !== alertId))
        }
      })
    } else {
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    }

    setCleared(prev => {
      const next = prev + 1
      setTotalCleared(t => t + 1)
      if (next >= WAVE_CONFIG[wave].target) {
        clearInterval(spawnIntervalRef.current)
        clearInterval(timerRef.current)
        
        if (wave >= 2) {
          setStatus('complete')
          setTimeout(onSolved, 3000)
        } else {
          // Trigger interlude
          setInterludeId((wave === 0 ? 1 : 2) as 1 | 2)
          setStatus('interlude')
          setInterludeInput('')
          setInterludeError('')
          setInterludeCooldown(0)
        }
      }
      return next
    })
  }, [wave, onSolved])

  const handleAlertInputChange = (id: string, value: string) => {
    setAlertInputs(prev => ({ ...prev, [id]: value }))
  }

  const handleAlertSubmit = (alert: Alert) => {
    const val = (alertInputs[alert.id] || '').trim().toUpperCase()
    if (val === alert.solution) {
      dismissAlert(alert.id)
      setAlertInputs(prev => {
        const copy = { ...prev }
        delete copy[alert.id]
        return copy
      })
    } else {
      // Visual shake shake
      const el = document.getElementById(alert.id)
      if (el) {
        gsap.fromTo(el, { x: -6 }, { x: 6, duration: 0.08, repeat: 5, yoyo: true, onComplete: () => { el.style.transform = '' } })
      }
    }
  }

  // Timer countdown
  useEffect(() => {
    if (status !== 'active') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          clearInterval(spawnIntervalRef.current)
          setStatus('failed')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [status])

  // Spawn loop
  useEffect(() => {
    if (status !== 'active') return
    const config = WAVE_CONFIG[wave]
    spawnIntervalRef.current = setInterval(spawnAlert, config.spawnRate)
    spawnAlert()
    return () => clearInterval(spawnIntervalRef.current)
  }, [status, wave, spawnAlert])

  // Interlude cooldown timer
  useEffect(() => {
    if (interludeCooldown <= 0) return
    interludeTimerRef.current = setInterval(() => {
      setInterludeCooldown(c => {
        if (c <= 1) {
          clearInterval(interludeTimerRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interludeTimerRef.current)
  }, [interludeCooldown])

  function handleRetry() {
    setCleared(0)
    setAlerts([])
    setTimeLeft(WAVE_CONFIG[wave].duration)
    setStatus('active')
  }

  const [isVerifying, setIsVerifying] = useState(false)

  async function handleInterludeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (interludeCooldown > 0 || isVerifying) return
    setIsVerifying(true)

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "07",
          puzzleKey: interludeId === 1 ? "interlude-1" : "interlude-2",
          answer: interludeInput
        })
      })
      const data = await res.json()
      if (data.success && data.correct) {
        if (interludeId === 1) {
          // Proceed to wave 2
          setWave(1)
          setCleared(0)
          setAlerts([])
          setTimeLeft(WAVE_CONFIG[1].duration)
          setStatus('active')
        } else {
          // Proceed to wave 3
          setWave(2)
          setCleared(0)
          setAlerts([])
          setTimeLeft(WAVE_CONFIG[2].duration)
          setStatus('active')
        }
      } else {
        if (interludeId === 1) {
          setInterludeError('INVALID PROTOCOL KEY. TERMINAL LOCKED FOR 5 SECONDS.')
        } else {
          setInterludeError('DECRYPTION FAILURE. BACKUP POWER SHUTTING DOWN. TERMINAL LOCKED FOR 5 SECONDS.')
        }
        setInterludeCooldown(5)
      }
    } catch (err) {
      console.error(err)
      setInterludeError('COMMUNICATION ERROR. TERMINAL LOCKED FOR 5 SECONDS.')
      setInterludeCooldown(5)
    } finally {
      setIsVerifying(false)
    }
  }

  const config = WAVE_CONFIG[wave]
  const urgencyClass = wave === 0 ? '' : wave === 1 ? styles.alertUrgent : styles.alertCritical

  return (
    <div className={`${styles.alertDashboard} ${urgencyClass}`} style={{ minHeight: '520px' }}>
      {/* Header */}
      {status === 'active' && (
        <div className={styles.alertHeader}>
          <div className={styles.alertWaveLabel}>
            WAVE {wave + 1}/3 — {config.label}
          </div>
          <div className={styles.alertStats}>
            <span className={styles.alertTimer} style={{ color: timeLeft <= 15 ? '#ff4444' : '#4aff4a' }}>
              {timeLeft}s
            </span>
            <span className={styles.alertCleared}>
              {cleared}/{config.target} CLEARED
            </span>
          </div>
        </div>
      )}

      {/* Alert Grid */}
      {status === 'active' && (
        <div className={styles.alertGrid}>
          {alerts.map(alert => (
            <div
              key={alert.id}
              id={alert.id}
              className={styles.alertCard}
              style={{
                gridRow: alert.row + 1,
                gridColumn: alert.col + 1,
                borderColor: alert.type === 'critical' ? '#cc1111' : alert.type === 'coded' ? '#e8c060' : '#8b1a1a',
                background: alert.type === 'critical' ? '#250808' : alert.type === 'coded' ? '#181208' : '#1a0808',
                position: 'relative',
              }}
            >
              <div
                className={styles.alertCardHeader}
                style={{
                  color: alert.type === 'critical' ? '#ff3333' : alert.type === 'coded' ? '#e8c060' : '#ff4444',
                  fontWeight: 'bold',
                }}
              >
                {alert.type === 'critical' ? '⚠ CRITICAL ERR' : alert.type === 'coded' ? '🔑 CODED ALERT' : '⚠ BREACH DETECTED'}
              </div>
              <div className={styles.alertCardBody} style={{ padding: '0.2rem 0' }}>
                <p className={styles.alertSector} style={{ fontSize: '0.5rem', color: '#8a8070' }}>{alert.sector}</p>
                
                {alert.type === 'standard' && (
                  <p className={styles.alertMessage} style={{ fontSize: '0.55rem', minHeight: '32px' }}>{alert.message}</p>
                )}

                {alert.type === 'coded' && (
                  <div style={{ fontSize: '0.55rem', color: '#c8c0b0', minHeight: '32px' }}>
                    <p style={{ margin: 0, color: '#e8c060' }}>UNSCRAMBLE WORD:</p>
                    <code style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', letterSpacing: '0.1em' }}>{alert.scrambled}</code>
                  </div>
                )}

                {alert.type === 'critical' && (
                  <div style={{ fontSize: '0.55rem', color: '#cc4444', minHeight: '32px' }}>
                    <p style={{ margin: 0, color: '#ff5555' }}>ARITHMETIC OVERRIDE:</p>
                    <code style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>{alert.scrambled}</code>
                  </div>
                )}
              </div>

              {alert.type === 'standard' ? (
                <button
                  className={styles.acknowledgeBtn}
                  onClick={() => dismissAlert(alert.id)}
                >
                  ACKNOWLEDGE
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '2px', marginTop: 'auto' }}>
                  <input
                    type="text"
                    placeholder={alert.type === 'coded' ? 'Word...' : 'Result...'}
                    value={alertInputs[alert.id] || ''}
                    onChange={(e) => handleAlertInputChange(alert.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAlertSubmit(alert)
                    }}
                    style={{
                      width: '65%',
                      background: '#0a0a0a',
                      border: '1px solid #3a3020',
                      color: '#fff',
                      fontSize: '0.55rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      padding: '2px 4px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={() => handleAlertSubmit(alert)}
                    style={{
                      width: '35%',
                      background: '#3a3020',
                      border: '1px solid #5a4a30',
                      color: '#c8c0b0',
                      fontSize: '0.5rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interludes */}
      {status === 'interlude' && (
        <div style={{
          background: '#050505',
          border: '1px solid #1a4a1a',
          padding: '2rem',
          margin: '1rem auto',
          maxWidth: '550px',
          fontFamily: 'var(--font-mono, monospace)',
          boxShadow: '0 0 30px rgba(26,74,26,0.15)',
        }}>
          <h3 style={{
            color: '#4aff4a',
            fontSize: '1rem',
            marginTop: 0,
            borderBottom: '1px solid #1a4a1a',
            paddingBottom: '0.5rem',
            letterSpacing: '0.05em'
          }}>
            {interludeId === 1 ? '⚠ CONTAINMENT PROTOCOL ALPHA' : '⚡ EMERGENCY SYSTEM BYPASS'}
          </h3>
          
          {interludeId === 1 ? (
            <div style={{ color: '#c8bca8', fontSize: '0.75rem', lineHeight: '1.5' }}>
              <p><strong>SECURITY DIRECTIVE — PROJECT NULL:</strong></p>
              <p style={{ fontStyle: 'italic', color: '#a09080', margin: '0.5rem 0' }}>&quot;Primary containment grid stabilized, but a secondary leak has breached Sector 4. To prevent the organism from bypassing the final containment gates, we have locked the sector behind a standard security protocol. Unscramble the protocol activation key below to engage the secondary isolation gates.&quot;</p>
              
              <div style={{
                background: '#0a100a',
                border: '1px dashed #2d5933',
                padding: '1.5rem',
                margin: '1.2rem 0',
                textAlign: 'center',
              }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#8a8070', fontSize: '0.65rem' }}>SCRAMBLED GATE KEY:</p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '1rem',
                  fontSize: '1.6rem',
                  fontWeight: 'bold',
                  color: '#4aff4a',
                  letterSpacing: '0.1em'
                }}>
                  R A U N Q T I N A E
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#c8bca8', fontSize: '0.75rem', lineHeight: '1.5' }}>
              <p><strong>LOGISTICS MAIN SYSTEM DIAGNOSTICS:</strong></p>
              <p style={{ fontStyle: 'italic', color: '#a09080', margin: '0.5rem 0' }}>&quot;Warning: Critical network overload detected. Standby backup power cells are draining. To bypass the system failsafe and activate the final diagnostics grid, you must manually decode the 8-bit ASCII binary sequence and input the plaintext bypass command.&quot;</p>
              
              <div style={{
                background: '#0a100a',
                border: '1px dashed #2d5933',
                padding: '1.2rem',
                margin: '1.2rem 0',
                textAlign: 'center',
              }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#8a8070', fontSize: '0.65rem' }}>BINARY SECURE SEQUENCE:</p>
                <code style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: '#4aff4a',
                  wordBreak: 'break-all',
                  lineHeight: '1.6',
                }}>
                  01010011 &nbsp; 01010101 &nbsp; 01010010 &nbsp; 01010110 <br />
                  01001001 &nbsp; 01010110 &nbsp; 01000001 &nbsp; 01001100
                </code>
              </div>
            </div>
          )}


          <form onSubmit={handleInterludeSubmit} style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                disabled={interludeCooldown > 0}
                placeholder={interludeCooldown > 0 ? `LOCKED (${interludeCooldown}s)` : "Enter decoded key..."}
                value={interludeInput}
                onChange={e => setInterludeInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#000',
                  border: '1px solid #1a4a1a',
                  color: '#4aff4a',
                  padding: '0.6rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.8rem',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="submit"
                disabled={interludeCooldown > 0}
                style={{
                  background: interludeCooldown > 0 ? '#111' : '#1a4a1a',
                  border: '1px solid #2d5933',
                  color: interludeCooldown > 0 ? '#555' : '#4aff4a',
                  padding: '0.6rem 1.2rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: interludeCooldown > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                EXECUTE
              </button>
            </div>
            {interludeError && (
              <p style={{
                color: '#ff4444',
                fontSize: '0.65rem',
                marginTop: '0.8rem',
                minHeight: '1.2em',
                lineHeight: 1.4,
              }}>
                {interludeError}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Failed */}
      {status === 'failed' && (
        <div className={styles.alertFailed}>
          <h3>WAVE {wave + 1} TIMEOUT</h3>
          <p>Restart Wave {wave + 1} containment protocol.</p>
          <button onClick={handleRetry} className={styles.retryBtn}>
            RETRY WAVE {wave + 1}
          </button>
        </div>
      )}

      {/* Complete */}
      {status === 'complete' && (
        <div className={styles.alertComplete}>
          <h3>CONTAINMENT RESTORED</h3>
          <p>All alerts eliminated. {totalCleared} breaches acknowledged.</p>
          <p className={styles.alertCompleteSubtext}>Proceeding to anomaly analysis...</p>
        </div>
      )}
    </div>
  )
}

