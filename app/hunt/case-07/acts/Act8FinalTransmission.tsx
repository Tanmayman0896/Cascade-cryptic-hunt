'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ActCinematicIntro } from '../components/ActCinematicIntro'
import { DialogueBox } from '../components/DialogueBox'
import { MessageReconstruction } from '../components/MessageReconstruction'
import { PuzzleInput } from '@/components/case-07/shared/PuzzleInput'
import { useActProgress } from '../hooks/useActProgress'
import styles from '../operation-deadlight.module.css'

export function Act8FinalTransmission({ onPuzzleSolved }: { onPuzzleSolved: () => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  const { isComplete } = useActProgress()
  const isAct8Complete = isComplete('act-8')
  const [reconstructionSolved, setReconstructionSolved] = useState(false)

  // Glitch and Typewriter story ending states
  const [isGlitching, setIsGlitching] = useState(false)
  const [showFinalNotes, setShowFinalNotes] = useState(false)
  const [typedNotes, setTypedNotes] = useState<string[]>([])
  const [allNotesDone, setAllNotesDone] = useState(false)
  const notesContainerRef = useRef<HTMLDivElement>(null)

  const storyLines = [
    '=============================================',
    'CASE FILE 07 — OPERATION DEADLIGHT',
    'FILE DESIGNATION: CF-07-OK-1996',
    'ARCHIVE DEPTH: LEVEL IX (EYES ONLY)',
    'CLASSIFICATION: NEXUS',
    'STATUS: HIGHLY REDACTED',
    '=============================================',
    'ACCESSING ARCHIVED TRANSMISSION LOGS...',
    'DECRYPTION KEY VERIFIED: STATUS SUCCESS.',
    '---------------------------------------------',
    '',
    'CASE FILE 07 — FINAL DIRECTORY REPORT:',
    '• SITE KENNEDY: COMPROMISED (1996)',
    '• OPERATION STATUS: TERMINATED & ARCHIVED',
    '• CONTAINMENT PROTOCOL: ACTIVE (LEVEL IX)',
    '',
    'WARNING: DETECTING ANOMALOUS MEMORY VECTORS...',
    '',
    '“It isn\'t spreading.”',
    '“It\'s replacing.”',
    '',
    '“None of us remember arriving here.”',
    '',
    '---------------------------------------------',
    '🚨 ALERT: ANOMALY SIGNATURE CONGRUENCE DETECTED.',
    '• Recurring Black Symbol: PRESENT',
    '• Identity Distortion Signature: ACTIVE',
    '• Memory Decay Index: 98.4%',
    '',
    '=============================================',
    'WHAT IS BURIED IN THE NULL WILL NEVER BE LOST.',
    '=============================================',
    '',
    'Cross-file correlation successfully completed.',
    'Additional declassified records unlocked.',
    'SYSTEM ERROR: BIOMETRIC CORRUPTION ACTIVE...',
    'LOCKOUT INITIATED BY SYSTEM ADMINISTRATOR.',
    'EXITING TIMELINE ARCHIVE...',
  ]

  const handleCorrect = () => {
    setIsGlitching(true)
    setTimeout(() => {
      setIsGlitching(false)
      setShowFinalNotes(true)
      onPuzzleSolved()
    }, 2500)
  }

  // Typewriter scroll loop
  useEffect(() => {
    if (!showFinalNotes) return
    let timerId: NodeJS.Timeout
    let isCancelled = false
    let currentIndex = 0
    setTypedNotes([]) // Clear on trigger

    const tick = () => {
      if (isCancelled) return
      if (currentIndex < storyLines.length) {
        const nextLine = storyLines[currentIndex]
        setTypedNotes(prev => [...prev, nextLine])
        currentIndex++
        timerId = setTimeout(tick, 220) // Slower typing pace for readability
        
        // Auto-scroll logic inside ref
        if (notesContainerRef.current) {
          notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight
        }
      } else {
        setAllNotesDone(true)
        timerId = setTimeout(() => {
          if (!isCancelled) {
            window.location.href = '/hunt'
          }
        }, 12000) // 12 seconds auto-redirect delay
      }
    }

    timerId = setTimeout(tick, 220)

    return () => {
      isCancelled = true
      clearTimeout(timerId)
    }
  }, [showFinalNotes])

  // Ensure reconstructionSolved is set to true on mount if act-8 is already complete
  useEffect(() => {
    if (isAct8Complete) {
      setReconstructionSolved(true)
    }
  }, [isAct8Complete])

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.from(sectionRef.current, {
        opacity: 0, duration: 0.6,
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' }
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <>
      <ActCinematicIntro
        index="08"
        act="FINAL TRANSMISSION"
        title="THE LAST MESSAGE"
        transmission="CORRUPTED TRANSMISSION // 11 MONTHS TO RECONSTRUCT // THE MESSAGE WAS AN INSTRUCTION"
        danger
      />

      <section ref={sectionRef} className={`${styles.act} ${styles.finalAct}`}>
        <div className={styles.static} />
        <div className={styles.fractureShards}>
          <i /><i /><i />
        </div>

        <div className={styles.actContent} style={{ zIndex: 10 }}>
          <p className={styles.chapter}>Final Transmission</p>
          <h2>It was an <em>instruction.</em></h2>

          <DialogueBox
            speaker="PROJECT NULL — RECONSTRUCTED MEMO"
            side="left"
            style="classified"
            text="We successfully intercepted the final transmission from Site Kennedy. It was corrupted beyond standard recognition. It took task force engineers 11 months of deep-scan timeline calculations to partially reconstruct the stream. What we recovered changed everything. The message was not a distress call—it was a direct instruction."
          />

          <div className={styles.narrativeEtch} style={{ marginTop: '2rem', marginBottom: '2rem', lineHeight: '1.7' }}>
            <p>The final logs indicate that Leon S. Kennedy located the Aetherion fragment embedded in theLas Plagas parasite cluster. Rather than returning, he merged the fragment's temporal wave signature with the terminal archives to prevent external replication. The fragment was never lost; it chose its host, waiting for a recovery agent with the correct cross-act authorization vector.</p>
            <p style={{ marginTop: '1rem' }}>Reconstruct the final transmission logs below. Solve the character scrambling grid, verify the cross-act logic gaps, decode the final line of the transmission, and align the temporal waveforms to retrieve the Aetherion fragment.</p>
          </div>

          <MessageReconstruction onSolved={() => setReconstructionSolved(true)} />

          <div style={{ marginTop: '2rem' }}>
            <DialogueBox
              speaker="SYSTEM"
              side="center"
              style="system"
              text="The fragment's name was hidden in the transmission all along. Enter the name of the artifact to complete the recovery."
            />
            <PuzzleInput
              puzzleId="final-transmission"
              timelineId="operation-deadlight"
              onCorrect={handleCorrect}
              placeholder="Enter the artifact name..."
              theme="terminal"
            />
          </div>
        </div>
      </section>

      {/* Glitch flashy overlay after key submission */}
      {isGlitching && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-red-950/60 animate-[pulse_0.1s_infinite] flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-red-900/30 mix-blend-color-burn" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.98)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px]" />
          
          <div className="w-full h-3 bg-red-500/35 absolute top-1/3 left-0 animate-[bounce_0.15s_infinite]" />
          <div className="w-full h-1 bg-cyan-500/25 absolute top-2/3 left-0 animate-[bounce_0.2s_infinite]" />
          
          <div className="text-center p-8 bg-black border-2 border-red-800 rounded shadow-2xl relative max-w-sm">
            <div className="font-mono text-red-500 text-base font-bold tracking-[0.3em] uppercase mb-2 animate-pulse">
              ⚠️ SYSTEM BREAKDOWN ⚠️
            </div>
            <div className="font-mono text-zinc-400 text-xs tracking-widest uppercase">
              EXTRACTING LOG FILES // TERMINATING TRANSMISSION FLOW
            </div>
          </div>
        </div>
      )}

      {/* Narrative slow scroll typewriter ending */}
      {showFinalNotes && (
        <div className="fixed inset-0 z-50 bg-[#060403] flex items-center justify-center p-6 md:p-12">
          {/* CRT scanlines and layout overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)] z-10" />
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] z-10" />

          <div 
            ref={notesContainerRef}
            className="w-full max-w-3xl h-full max-h-[85vh] overflow-y-auto bg-[#0d0705] border border-[#3a1a10] rounded p-6 font-mono text-[11px] md:text-[13px] leading-relaxed text-[#c0b5a4] scrollbar-none"
            style={{ scrollBehavior: 'smooth' }}
          >
            {typedNotes.map((line, idx) => {
              const isHeading = line.startsWith('===') || line.startsWith('CASE FILE 07') || line.startsWith('STAGE') || line.startsWith('CASE CONCLUSION') || line.startsWith('CRITICAL')
              const isAlert = line.startsWith('🚨') || line.startsWith('WARNING') || line.startsWith('ERROR') || line.startsWith('LOCKOUT')
              const isQuote = line.startsWith('“')

              let color = '#c0b5a4'
              let fontWeight = 'normal'
              if (isHeading) {
                color = '#ff9100'
                fontWeight = 'bold'
              } else if (isAlert) {
                color = '#ff1744'
                fontWeight = 'bold'
              } else if (isQuote) {
                color = '#ffffff'
                fontWeight = 'bold'
              }

              return (
                <p key={idx} style={{ color, fontWeight, margin: '0.45rem 0', paddingLeft: line.startsWith('•') ? '1rem' : '0' }}>
                  {line || '\u00A0'}
                </p>
              )
            })}

            {allNotesDone && (
              <div className="mt-8 border border-[#ff1744] bg-[#ff1744]/10 p-4 rounded text-center animate-pulse">
                <p className="text-[#ff1744] text-sm font-bold tracking-widest uppercase m-0">
                  SYSTEM OVERRIDE LOCKDOWN COMPLETE
                </p>
                <p className="text-zinc-500 text-xs mt-1">
                  Ejecting secure agent session... Returning to hub...
                </p>
                <button
                  onClick={() => { window.location.href = '/hunt' }}
                  style={{
                    marginTop: '1rem',
                    background: '#ff1744',
                    border: 'none',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '0.6rem 1.2rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase'
                  }}
                >
                  Return to Hub (Skip Delay)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

