import React, { useState, useEffect } from 'react';

// --- LIGHTS OUT LOGIC ---
const getNeighbors = (index: number): number[] => {
  const neighbors = [index];
  if (index % 3 !== 0) neighbors.push(index - 1); // left
  if (index % 3 !== 2) neighbors.push(index + 1); // right
  if (index >= 3) neighbors.push(index - 3); // up
  if (index < 6) neighbors.push(index + 3); // down
  return neighbors;
};

interface LightsOutPuzzleProps {
  activeAnomaly: {
    pattern?: number[];
  };
  onSolve: () => void;
}

function LightsOutPuzzle({ activeAnomaly, onSolve }: LightsOutPuzzleProps) {
  const [grid, setGrid] = useState<boolean[]>(Array(9).fill(true));
  const [isSolving, setIsSolving] = useState<boolean>(false);

  useEffect(() => {
    let initialGrid = Array(9).fill(true);
    if (activeAnomaly.pattern) {
      activeAnomaly.pattern.forEach(clickIndex => {
        const neighbors = getNeighbors(clickIndex);
        initialGrid = initialGrid.map((val, i) => neighbors.includes(i) ? !val : val);
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrid(initialGrid);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSolving(false);
  }, [activeAnomaly]);

  const handleCellClick = (index: number) => {
    if (isSolving) return;
    const neighbors = getNeighbors(index);
    const newGrid = grid.map((val, i) => neighbors.includes(i) ? !val : val);
    setGrid(newGrid);

    if (newGrid.every(val => val === true)) {
      setIsSolving(true);
      setTimeout(onSolve, 1000);
    }
  };

  return (
    <>
      <p className="question-text" style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
        Align all nodes to decrypt this terminal.
      </p>
      <div className="decryption-grid">
        {grid.map((isAligned, index) => (
          <div 
            key={index} 
            className={`decryption-cell ${isAligned ? 'aligned' : 'corrupted'} ${isSolving ? 'solving' : ''}`}
            onClick={() => handleCellClick(index)}
          >
            <div className="glyph-inner"></div>
          </div>
        ))}
      </div>
    </>
  );
}

// --- WEIGHT BALANCING PUZZLE ---
interface WeightBalancePuzzleProps {
  anomalyKey: string;
  onSolve: () => void;
}

const ITEMS = [
  { id: 'feather', name: 'Feather of Truth', weight: 1, img: '/case-file-01/feather.png' },
  { id: 'ankh', name: 'Ankh Amulet', weight: 2, img: '/case-file-01/ankh.png' },
  { id: 'urn', name: 'Golden Urn', weight: 3, img: '/case-file-01/urn.png' },
  { id: 'anvil', name: 'Iron Anvil', weight: 6, img: '/case-file-01/anvil.png' },
];

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function WeightBalancePuzzle({ anomalyKey, onSolve }: WeightBalancePuzzleProps) {
  const [targetWeight] = useState(() => {
    const val = hashCode(anomalyKey);
    return val % 2 === 0 ? 3 : 6;
  });

  const [leftPlacedIds, setLeftPlacedIds] = useState<string[]>([]);
  const [rightPlacedIds, setRightPlacedIds] = useState<string[]>([]);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  const leftPlacedWeight = leftPlacedIds.reduce((sum, id) => {
    const item = ITEMS.find(it => it.id === id);
    return sum + (item ? item.weight : 0);
  }, 0);

  const rightPlacedWeight = rightPlacedIds.reduce((sum, id) => {
    const item = ITEMS.find(it => it.id === id);
    return sum + (item ? item.weight : 0);
  }, 0);

  const isBalanced = leftPlacedWeight === rightPlacedWeight && leftPlacedWeight === targetWeight;

  useEffect(() => {
    if (isBalanced && !isSolving) {
      setIsSolving(true);
      setTimeout(onSolve, 1500);
    }
  }, [isBalanced, isSolving, onSolve]);

  const handlePlaceLeft = (id: string) => {
    if (isSolving) return;
    setRightPlacedIds(prev => prev.filter(itemId => itemId !== id));
    setLeftPlacedIds(prev => [...prev.filter(itemId => itemId !== id), id]);
  };

  const handlePlaceRight = (id: string) => {
    if (isSolving) return;
    setLeftPlacedIds(prev => prev.filter(itemId => itemId !== id));
    setRightPlacedIds(prev => [...prev.filter(itemId => itemId !== id), id]);
  };

  const handleRecall = (id: string) => {
    if (isSolving) return;
    setLeftPlacedIds(prev => prev.filter(itemId => itemId !== id));
    setRightPlacedIds(prev => prev.filter(itemId => itemId !== id));
  };

  const diff = rightPlacedWeight - leftPlacedWeight;
  let tilt = 0;
  if (leftPlacedWeight > 0 || rightPlacedWeight > 0) {
    tilt = diff < 0 ? Math.max(-12, diff * 1.5) : Math.min(12, diff * 1.5);
  }

  return (
    <div className="weight-balance-puzzle">
      <p className="question-text" style={{ marginBottom: '1.2rem', fontSize: '1rem', lineHeight: 1.4 }}>
        Balance the sacred scale. Both pans must balance exactly at a weight of: <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{targetWeight}</span>.
        Place weights on either side to align the path.
      </p>
      
      {/* THE SCALE */}
      <div className="scale-container">
        <div className="scale-pivot"></div>
        <div className="scale-beam" style={{ transform: `rotate(${tilt}deg)` }}>
          
          {/* Left Pan */}
          <div className="scale-pan left-pan" style={{ transform: `rotate(${-tilt}deg)` }}>
            <div className="scale-pan-surface">
              <div className="placed-items-container" style={{ minHeight: '55px' }}>
                {leftPlacedIds.map(id => {
                  const item = ITEMS.find(it => it.id === id);
                  if (!item) return null;
                  return (
                    <img 
                      key={id} 
                      src={item.img} 
                      alt={item.name} 
                      className="placed-item-img"
                      title={item.name}
                      onClick={() => handleRecall(id)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Right Pan */}
          <div className="scale-pan right-pan" style={{ transform: `rotate(${-tilt}deg)` }}>
            <div className="scale-pan-surface">
              <div className="placed-items-container" style={{ minHeight: '55px' }}>
                {rightPlacedIds.map(id => {
                  const item = ITEMS.find(it => it.id === id);
                  if (!item) return null;
                  return (
                    <img 
                      key={id} 
                      src={item.img} 
                      alt={item.name} 
                      className="placed-item-img"
                      title={item.name}
                      onClick={() => handleRecall(id)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div style={{ margin: '1rem 0 1.5rem', fontSize: '0.95rem', fontFamily: 'var(--font-main)', color: isBalanced ? 'var(--color-success)' : 'var(--color-text)' }}>
        STATUS: <span style={{ color: isBalanced ? 'var(--color-success)' : 'var(--color-accent)', fontWeight: 'bold' }}>
          {isBalanced ? "SCALE BALANCED - PATH ALIGNED" : 
           (leftPlacedWeight === 0 && rightPlacedWeight === 0) ? "SCALE IS EMPTY" :
           leftPlacedWeight === rightPlacedWeight ? "BALANCED BUT NOT AT TARGET COUNTERWEIGHT" :
           diff < 0 ? "LEFT PAN IS HEAVIER" : "RIGHT PAN IS HEAVIER"}
        </span>
      </div>

      {/* INVENTORY */}
      <div className="inventory-grid">
        {ITEMS.map(item => {
          const isLeft = leftPlacedIds.includes(item.id);
          const isRight = rightPlacedIds.includes(item.id);
          return (
            <div 
              key={item.id} 
              className={`inventory-item ${(isLeft || isRight) ? 'placed' : ''}`}
            >
              <img src={item.img} alt={item.name} className="inventory-item-img" onClick={() => handleRecall(item.id)} />
              <div className="inventory-item-info">
                <span className="item-name">{item.name}</span>
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  {!(isLeft || isRight) ? (
                    <>
                      <button 
                        type="button" 
                        className="basic-btn" 
                        onClick={() => handlePlaceLeft(item.id)}
                        style={{ padding: '2px 6px', fontSize: '0.75rem', borderColor: 'var(--color-accent)', color: 'var(--color-accent)', background: 'transparent', cursor: 'pointer' }}
                      >
                        Left
                      </button>
                      <button 
                        type="button" 
                        className="basic-btn" 
                        onClick={() => handlePlaceRight(item.id)}
                        style={{ padding: '2px 6px', fontSize: '0.75rem', borderColor: 'var(--color-accent)', color: 'var(--color-accent)', background: 'transparent', cursor: 'pointer' }}
                      >
                        Right
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', alignSelf: 'center' }}>
                        {isLeft ? "On Left" : "On Right"}
                      </span>
                      <button 
                        type="button" 
                        className="basic-btn" 
                        onClick={() => handleRecall(item.id)}
                        style={{ padding: '2px 6px', fontSize: '0.75rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'transparent', cursor: 'pointer' }}
                      >
                        Recall
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// --- SEQUENCE LOGIC ---
interface SequencePuzzleProps {
  activeAnomaly: {
    sequenceLength?: number;
  };
  onSolve: () => void;
}

function SequencePuzzle({ activeAnomaly, onSolve }: SequencePuzzleProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerStep, setPlayerStep] = useState<number>(0);
  const [isShowing, setIsShowing] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(false);

  const playSequence = (seq: number[]) => {
    setIsShowing(true);
    let step = 0;
    const interval = setInterval(() => {
      if (step >= seq.length) {
        clearInterval(interval);
        setActiveIndex(null);
        setIsShowing(false);
        return;
      }
      setActiveIndex(seq[step]);
      setTimeout(() => setActiveIndex(null), 400);
      step++;
    }, 800);
  };

  useEffect(() => {
    const len = activeAnomaly.sequenceLength || 4;
    const newSeq = Array.from({length: len}, () => Math.floor(Math.random() * 4));
    setSequence(newSeq);
    setPlayerStep(0);
    setSolved(false);
    setError(false);
    
    const timer = setTimeout(() => playSequence(newSeq), 500);
    return () => clearTimeout(timer);
  }, [activeAnomaly]);

  const handleTileClick = (index: number) => {
    if (isShowing || solved || error) return;

    setActiveIndex(index);
    setTimeout(() => setActiveIndex(null), 200);

    if (index === sequence[playerStep]) {
      const nextStep = playerStep + 1;
      setPlayerStep(nextStep);
      if (nextStep === sequence.length) {
        setSolved(true);
        setTimeout(onSolve, 1000);
      }
    } else {
      setError(true);
      setTimeout(() => {
        setError(false);
        setPlayerStep(0);
        playSequence(sequence);
      }, 1000);
    }
  };

  return (
    <>
      <p className="question-text" style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
        Observe and repeat the signal sequence.
      </p>
      <div className="sequence-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '200px', margin: '0 auto'
      }}>
        {[0, 1, 2, 3].map(index => (
          <div 
            key={index}
            onClick={() => handleTileClick(index)}
            className={`sequence-cell ${activeIndex === index ? 'active' : ''} ${error ? 'error' : ''} ${solved ? 'solved' : ''}`}
            style={{
              aspectRatio: '1/1',
              border: '2px solid var(--color-danger)',
              background: 'rgba(0,0,0,0.8)',
              cursor: isShowing ? 'default' : 'pointer',
              transition: 'all 0.1s'
            }}
          ></div>
        ))}
      </div>
    </>
  );
}

// --- TIC TAC TOE LOGIC ---
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

const checkWinner = (b: (string | null)[]): string | null => {
  for (let combo of WINNING_COMBOS) {
    const [a, c, d] = combo;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return b[a];
    }
  }
  if (b.every(cell => cell !== null)) return 'draw';
  return null;
};

const getComputerMove = (b: (string | null)[]): number => {
  // 1. Can AI win?
  for (let i = 0; i < 9; i++) {
    if (b[i] === null) {
      const copy = [...b];
      copy[i] = 'O';
      if (checkWinner(copy) === 'O') return i;
    }
  }

  // 2. Can player win (block)?
  for (let i = 0; i < 9; i++) {
    if (b[i] === null) {
      const copy = [...b];
      copy[i] = 'X';
      if (checkWinner(copy) === 'X') return i;
    }
  }

  // 3. Take center
  if (b[4] === null) return 4;

  // 4. Take corner
  const corners = [0, 2, 6, 8].filter(i => b[i] === null);
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  // 5. Take any empty
  const empties: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (b[i] === null) empties.push(i);
  }
  return empties[Math.floor(Math.random() * empties.length)];
};

interface TicTacToePuzzleProps {
  onSolve: () => void;
}

function TicTacToePuzzle({ onSolve }: TicTacToePuzzleProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<'player' | 'computer'>('player');
  const [status, setStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing');

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setTurn('player');
    setStatus('playing');
  };

  const handleCellClick = (index: number) => {
    if (board[index] || turn !== 'player' || status !== 'playing') return;

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);

    const winner = checkWinner(newBoard);
    if (winner === 'X') {
      setStatus('won');
      fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "01",
          puzzleKey: "tic_tac_toe",
          answer: "victory"
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.correct) {
          setTimeout(onSolve, 1500);
        }
      });
      return;
    } else if (winner === 'draw') {
      setStatus('draw');
      setTimeout(resetGame, 1500);
      return;
    }

    setTurn('computer');
  };

  useEffect(() => {
    if (turn === 'computer' && status === 'playing') {
      const timer = setTimeout(() => {
        const move = getComputerMove(board);
        if (move !== undefined && move >= 0 && move < 9) {
          const newBoard = [...board];
          newBoard[move] = 'O';
          setBoard(newBoard);

          const winner = checkWinner(newBoard);
          if (winner === 'O') {
            setStatus('lost');
            setTimeout(resetGame, 1500);
          } else if (winner === 'draw') {
            setStatus('draw');
            setTimeout(resetGame, 1500);
          } else {
            setTurn('player');
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [turn, board, status]);

  return (
    <>
      <p className="question-text" style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>
        {status === 'playing' && (
          turn === 'player' ? "Your turn. Align three golden glyphs to seal the node." : "Guardian is scanning the grid..."
        )}
        {status === 'won' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>ACCESS GRANTED - NODE SEALED!</span>}
        {status === 'lost' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>NODE CORRUPTED - RETRYING...</span>}
        {status === 'draw' && <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>GRID STALEMATE - RETRYING...</span>}
      </p>
      
      <div className="decryption-grid" style={{ maxWidth: '240px' }}>
        {board.map((cell, index) => {
          let cellBorderColor = 'var(--color-accent)';
          if (cell === 'X') cellBorderColor = 'var(--color-success)';
          if (cell === 'O') cellBorderColor = 'var(--color-danger)';

          return (
            <div 
              key={index} 
              className={`decryption-cell`}
              style={{
                borderColor: cellBorderColor,
                aspectRatio: '1/1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (cell || turn !== 'player' || status !== 'playing') ? 'default' : 'pointer'
              }}
              onClick={() => handleCellClick(index)}
            >
              {cell === 'X' && (
                <span style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: 'var(--color-success)',
                  lineHeight: 1
                }}>
                  X
                </span>
              )}
              {cell === 'O' && (
                <span style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: 'var(--color-danger)',
                  lineHeight: 1
                }}>
                  O
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// --- WORD FIND LOGIC ---
const WORD_SEARCH_GRID = [
  ['T', 'O', 'M', 'B', 'K', 'U', 'V', 'S', 'E', 'A', 'L', 'W'],
  ['Q', 'C', 'R', 'Y', 'P', 'T', 'Y', 'U', 'G', 'O', 'L', 'D'],
  ['O', 'S', 'I', 'R', 'I', 'S', 'J', 'F', 'K', 'H', 'Z', 'M'],
  ['P', 'Q', 'V', 'Y', 'L', 'X', 'A', 'N', 'U', 'B', 'I', 'S'],
  ['S', 'C', 'A', 'R', 'A', 'B', 'W', 'Q', 'R', 'A', 'S', 'D'],
  ['Z', 'M', 'U', 'M', 'M', 'Y', 'C', 'V', 'B', 'N', 'M', 'S'],
  ['X', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'G', 'Y', 'P', 'T'],
  ['S', 'P', 'H', 'I', 'N', 'X', 'K', 'L', 'M', 'N', 'O', 'P'],
  ['Q', 'R', 'S', 'T', 'U', 'V', 'T', 'E', 'M', 'P', 'L', 'E'],
  ['A', 'R', 'U', 'I', 'N', 'B', 'S', 'A', 'C', 'R', 'E', 'D'],
  ['X', 'Y', 'Z', 'C', 'U', 'R', 'S', 'E', 'W', 'Q', 'R', 'S'],
  ['A', 'B', 'C', 'D', 'E', 'D', 'E', 'A', 'T', 'H', 'F', 'G']
];

interface WordFindPuzzleProps {
  onSolve: () => void;
}

function WordFindPuzzle({ onSolve }: WordFindPuzzleProps) {
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [status, setStatus] = useState<'playing' | 'won' | 'loading'>('loading');
  const [searchWords, setSearchWords] = useState<string[]>([]);
  const [coordinates, setCoordinates] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch("/api/questions?caseId=01&puzzleKey=word_find")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.questions.length > 0) {
          const parsed = JSON.parse(data.questions[0].question);
          setSearchWords(parsed.words);
          setCoordinates(parsed.coordinates);
          setStatus('playing');
        }
      })
      .catch(err => console.error(err));
  }, []);

  const isCellInFoundWord = (r: number, c: number) => {
    const coord = `${r},${c}`;
    return Object.entries(coordinates).some(([word, coords]) => 
      foundWords.includes(word) && coords.includes(coord)
    );
  };

  const handleCellClick = (r: number, c: number) => {
    if (status !== 'playing' || isCellInFoundWord(r, c)) return;

    const coord = `${r},${c}`;
    let newSelected = [...selectedCells];
    if (newSelected.includes(coord)) {
      newSelected = newSelected.filter(item => item !== coord);
    } else {
      if (newSelected.length >= 6) {
        newSelected = [coord];
      } else {
        newSelected.push(coord);
      }
    }
    setSelectedCells(newSelected);

    // Check if matching any word
    for (const [word, coords] of Object.entries(coordinates)) {
      if (!foundWords.includes(word)) {
        const isMatch = coords.every(co => newSelected.includes(co)) && newSelected.length === coords.length;
        if (isMatch) {
          const nextFound = [...foundWords, word];
          setFoundWords(nextFound);
          setSelectedCells([]);
          
          if (searchWords.length > 0 && nextFound.length === searchWords.length) {
            // Validate final found words list (sorted) on server
            const foundSorted = [...nextFound].sort().join(",");
            fetch("/api/questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                caseId: "01",
                puzzleKey: "word_find",
                answer: foundSorted
              })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success && data.correct) {
                setStatus('won');
                setTimeout(onSolve, 1500);
              }
            })
            .catch(err => console.error(err));
          }
          break;
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
      <p className="question-text" style={{ marginBottom: '0.3rem', fontSize: '0.95rem', lineHeight: 1.3 }}>
        {status === 'loading' && "Loading archive grid..."}
        {status === 'playing' && "Decipher the ancient glyph grid to locate 15 key terms."}
        {status === 'won' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>TERMINAL ACCESSED - ENCRYPTION SEALED!</span>}
      </p>

      {/* WORDS LIST */}
      <div style={{ 
        display: 'flex', 
        gap: '6px', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
        marginBottom: '0.3rem', 
        maxHeight: '120px', 
        overflowY: 'auto',
        padding: '4px',
        border: '1px solid rgba(212, 175, 55, 0.15)',
        width: '100%'
      }}>
        {searchWords.map(word => {
          const isFound = foundWords.includes(word);
          return (
            <span 
              key={word} 
              style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                padding: '2px 6px',
                border: `1px solid ${isFound ? 'var(--color-success)' : 'rgba(212, 175, 55, 0.4)'}`,
                color: isFound ? 'var(--color-success)' : 'var(--color-text-muted)',
                textDecoration: isFound ? 'line-through' : 'none',
                background: isFound ? 'rgba(46, 204, 113, 0.15)' : 'transparent',
                borderRadius: '3px'
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '3px',
        width: '100%',
        maxWidth: '300px',
        aspectRatio: '1/1',
        background: 'rgba(0,0,0,0.6)',
        padding: '4px',
        border: '1px solid var(--color-accent)'
      }}>
        {WORD_SEARCH_GRID.map((row, r) => 
          row.map((letter, c) => {
            const coord = `${r},${c}`;
            const isSelected = selectedCells.includes(coord);
            const isFound = isCellInFoundWord(r, c);

            let cellBg = 'rgba(0, 0, 0, 0.8)';
            let cellBorder = '1px solid #111';
            let cellColor = 'var(--color-text)';

            if (isFound) {
              cellBg = 'rgba(46, 204, 113, 0.2)';
              cellBorder = '1px solid var(--color-success)';
              cellColor = 'var(--color-success)';
            } else if (isSelected) {
              cellBg = 'rgba(212, 175, 55, 0.25)';
              cellBorder = '1px solid var(--color-accent)';
              cellColor = 'var(--color-accent)';
            }

            return (
              <div
                key={coord}
                onClick={() => handleCellClick(r, c)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: cellBg,
                  border: cellBorder,
                  color: cellColor,
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  cursor: isFound ? 'default' : 'pointer',
                  userSelect: 'none',
                  aspectRatio: '1/1',
                  transition: 'all 0.15s ease'
                }}
              >
                {letter}
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
        <button 
          type="button" 
          onClick={() => setSelectedCells([])} 
          className="basic-btn"
          style={{ padding: '4px 12px', fontSize: '0.75rem' }}
          disabled={status !== 'playing' || selectedCells.length === 0}
        >
          Clear Selection ({selectedCells.length}/6)
        </button>
      </div>
    </div>
  );
}



interface TechQuizPuzzleProps {
  onSolve: () => void;
}

function TechQuizPuzzle({ onSolve }: TechQuizPuzzleProps) {
  const [questions, setQuestions] = useState<{ text: string; options: string[]; puzzleKey: string }[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'won' | 'loading'>('loading');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/questions?caseId=01")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const items = data.questions
            .filter((q: any) => q.puzzleKey.startsWith("tech_quiz_"))
            .map((q: any) => {
              const parsed = JSON.parse(q.question);
              return {
                text: parsed.text,
                options: parsed.options,
                puzzleKey: q.puzzleKey
              };
            })
            .sort((a: any, b: any) => {
              const numA = parseInt(a.puzzleKey.split("_")[2], 10);
              const numB = parseInt(b.puzzleKey.split("_")[2], 10);
              return numA - numB;
            });
          setQuestions(items);
          setStatus('playing');
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleAnswerClick = async (optIdx: number) => {
    if (status !== 'playing' || questions.length === 0) return;
    setSelectedIdx(optIdx);

    const q = questions[currentIdx];
    const selectedOption = q.options[optIdx];

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "01",
          puzzleKey: q.puzzleKey,
          answer: selectedOption
        })
      });
      const data = await res.json();
      if (data.success && data.correct) {
        setStatus('correct');
        setTimeout(() => {
          if (currentIdx === questions.length - 1) {
            setStatus('won');
            setTimeout(onSolve, 1000);
          } else {
            setCurrentIdx(prev => prev + 1);
            setStatus('playing');
            setSelectedIdx(null);
          }
        }, 800);
      } else {
        setStatus('wrong');
        setTimeout(() => {
          setCurrentIdx(0);
          setStatus('playing');
          setSelectedIdx(null);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setStatus('wrong');
    }
  };

  const q = questions[currentIdx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
      <p className="question-text" style={{ marginBottom: '0.2rem', fontSize: '1rem', lineHeight: 1.4 }}>
        {status === 'loading' && "Loading archive protocol..."}
        {status === 'playing' && `SECURITY PROTOCOL: Question ${currentIdx + 1} of ${questions.length}`}
        {status === 'correct' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>CORRECT ACCESS CODE - ALIGNING...</span>}
        {status === 'wrong' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>ACCESS DENIED - TERMINAL RESETTING...</span>}
        {status === 'won' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>NODE SECURED - ACCESS GRANTED!</span>}
      </p>

      {q && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid var(--color-accent)',
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: '1rem',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--color-text)'
          }}>
            {q.text}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {q.options.map((opt, idx) => {
              let btnColor = 'var(--color-accent)';
              let btnBg = 'transparent';

              if (selectedIdx === idx) {
                if (status === 'correct') {
                  btnColor = 'var(--color-success)';
                  btnBg = 'rgba(46, 204, 113, 0.15)';
                } else if (status === 'wrong') {
                  btnColor = 'var(--color-danger)';
                  btnBg = 'rgba(231, 76, 60, 0.15)';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswerClick(idx)}
                  className="basic-btn"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    borderColor: btnColor,
                    color: btnColor,
                    background: btnBg,
                    cursor: status === 'playing' ? 'pointer' : 'default'
                  }}
                >
                  <span style={{ fontWeight: 'bold', marginRight: '10px' }}>{String.fromCharCode(65 + idx)})</span> {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



const ELEMENT_ICONS: Record<string, string> = {
  IGNIS: "🔥 IGNIS",
  AQUA: "💧 AQUA",
  TERRA: "🪨 TERRA",
  AURA: "💨 AURA",
  AETHER: "✨ AETHER"
};

interface SpellMakingPuzzleProps {
  onSolve: () => void;
}

function SpellMakingPuzzle({ onSolve }: SpellMakingPuzzleProps) {
  const [spells, setSpells] = useState<{ name: string; description: string; ingredients: string[]; puzzleKey: string }[]>([]);
  const [recipeIdx, setRecipeIdx] = useState<number>(0);
  const [cauldron, setCauldron] = useState<string[]>([]);
  const [status, setStatus] = useState<'brewing' | 'success' | 'failed' | 'complete' | 'loading'>('loading');

  useEffect(() => {
    fetch("/api/questions?caseId=01")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const items = data.questions
            .filter((q: any) => q.puzzleKey.startsWith("spell_making_"))
            .map((q: any) => {
              const parsed = JSON.parse(q.question);
              return {
                name: parsed.name,
                description: parsed.description,
                ingredients: parsed.ingredients,
                puzzleKey: q.puzzleKey
              };
            })
            .sort((a: any, b: any) => {
              const numA = parseInt(a.puzzleKey.split("_")[2], 10);
              const numB = parseInt(b.puzzleKey.split("_")[2], 10);
              return numA - numB;
            });
          setSpells(items);
          setStatus('brewing');
        }
      })
      .catch(err => console.error(err));
  }, []);

  const addIngredient = (ing: string) => {
    if (status !== 'brewing') return;
    if (cauldron.length >= 4) return; // limit cauldron size
    setCauldron(prev => [...prev, ing]);
  };

  const clearCauldron = () => {
    if (status !== 'brewing') return;
    setCauldron([]);
  };

  const castSpell = async () => {
    if (status !== 'brewing' || spells.length === 0) return;

    const activeSpell = spells[recipeIdx];
    const mixedSorted = [...cauldron].sort().join(",");

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "01",
          puzzleKey: activeSpell.puzzleKey,
          answer: mixedSorted
        })
      });
      const data = await res.json();
      if (data.success && data.correct) {
        setStatus('success');
        setTimeout(() => {
          if (recipeIdx === spells.length - 1) {
            setStatus('complete');
            setTimeout(onSolve, 1000);
          } else {
            setRecipeIdx(prev => prev + 1);
            setCauldron([]);
            setStatus('brewing');
          }
        }, 1200);
      } else {
        setStatus('failed');
        setTimeout(() => {
          setCauldron([]);
          setStatus('brewing');
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setStatus('failed');
    }
  };

  const currentRecipe = spells[recipeIdx] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
      <p className="question-text" style={{ marginBottom: '0.2rem', fontSize: '1rem', lineHeight: 1.4 }}>
        {status === 'loading' && "Loading grimoire..."}
        {status === 'brewing' && `SPELL BOOK: Recipe ${recipeIdx + 1} of ${spells.length}`}
        {status === 'success' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>SPELL CAST SUCCESSFUL! ADVANCING...</span>}
        {status === 'failed' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>CAULDRON BACKFIRED - DISPELLING MIX...</span>}
        {status === 'complete' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>ANOMALY SEALED - ENCRYPTION BROKEN!</span>}
      </p>

      {currentRecipe && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {/* Target Recipe Display */}
          <div style={{
            background: 'rgba(10, 8, 7, 0.9)',
            border: '1px solid var(--color-accent)',
            padding: '12px 16px',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-accent)', fontWeight: 'bold', fontSize: '1.05rem', letterSpacing: '1px' }}>
                RECIPE: {currentRecipe.name}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{currentRecipe.description}</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Requires Elements:{" "}
              {currentRecipe.ingredients.map(ing => (
                <span 
                  key={ing} 
                  style={{
                    display: 'inline-block',
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    margin: '0 4px',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace'
                  }}
                >
                  {ELEMENT_ICONS[ing]}
                </span>
              ))}
            </div>
          </div>

          {/* Cauldron Display */}
          <div style={{
            height: '80px',
            width: '100%',
            background: 'rgba(0, 0, 0, 0.85)',
            border: `2px dashed ${status === 'failed' ? 'var(--color-danger)' : (status === 'success' ? 'var(--color-success)' : 'var(--color-accent)')}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            borderRadius: '8px',
            position: 'relative'
          }}>
            {cauldron.length === 0 ? (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Cauldron is empty. Add element runes.
              </span>
            ) : (
              cauldron.map((ing, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid var(--color-accent)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: 'var(--color-accent)'
                  }}
                >
                  {ELEMENT_ICONS[ing]}
                </div>
              ))
            )}
          </div>

          {/* Crafting Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {Object.entries(ELEMENT_ICONS).map(([key, name]) => (
              <button
                key={key}
                onClick={() => addIngredient(key)}
                className="basic-btn"
                style={{
                  padding: '10px 4px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  cursor: status === 'brewing' && cauldron.length < 4 ? 'pointer' : 'default',
                  opacity: cauldron.length >= 4 ? 0.6 : 1
                }}
              >
                {name.split(" ")[0]}
                <div style={{ fontSize: '0.65rem', marginTop: '2px', color: 'var(--color-text-muted)' }}>{key}</div>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', justifyContent: 'center' }}>
            <button 
              type="button" 
              onClick={clearCauldron} 
              className="basic-btn secondary-btn"
              style={{ padding: '8px 24px', fontSize: '0.85rem' }}
              disabled={status !== 'brewing' || cauldron.length === 0}
            >
              Empty Cauldron
            </button>
            <button 
              type="button" 
              onClick={castSpell} 
              className="basic-btn primary-btn"
              style={{ padding: '8px 24px', fontSize: '0.85rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
              disabled={status !== 'brewing' || cauldron.length === 0}
            >
              Cast Spell
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const BLOCK_NAMES = ["EMPTY", "🪨 BASE", "🏛️ PILLAR", "⚰️ CHAMBER", "👑 CAPSTONE"];
const BLOCK_COLORS = [
  "transparent",
  "rgba(139, 128, 112, 0.2)",
  "rgba(212, 175, 55, 0.15)",
  "rgba(155, 89, 182, 0.15)",
  "rgba(241, 196, 15, 0.3)"
];
const BLOCK_BORDER_COLORS = [
  "rgba(212, 175, 55, 0.3)",
  "rgba(139, 128, 112, 0.8)",
  "var(--color-accent)",
  "#9b59b6",
  "#f1c40f"
];

const getBlueprintText = (matrix: number[][] | undefined) => {
  if (!matrix) return "";
  return matrix.map(row => {
    return row.map(cell => {
      if (cell === 0) return "[   ]";
      if (cell === 1) return "[🪨]";
      if (cell === 2) return "[🏛️]";
      if (cell === 3) return "[⚰️]";
      if (cell === 4) return "[👑]";
      return "[   ]";
    }).join(" ");
  }).join("\n");
};

interface TombBuilderPuzzleProps {
  onSolve: () => void;
}

function TombBuilderPuzzle({ onSolve }: TombBuilderPuzzleProps) {
  const [levels, setLevels] = useState<{ name: string; grid: number[][]; puzzleKey: string }[]>([]);
  const [tombIdx, setTombIdx] = useState<number>(0);
  const [grid, setGrid] = useState<number[][]>([
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ]);
  const [status, setStatus] = useState<'drafting' | 'success' | 'completed' | 'loading'>('loading');

  useEffect(() => {
    fetch("/api/questions?caseId=01")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const items = data.questions
            .filter((q: any) => q.puzzleKey.startsWith("tomb_builder_"))
            .map((q: any) => {
              const parsed = JSON.parse(q.question);
              return {
                name: parsed.name,
                grid: parsed.grid,
                puzzleKey: q.puzzleKey
              };
            })
            .sort((a: any, b: any) => {
              const numA = parseInt(a.puzzleKey.split("_")[2], 10);
              const numB = parseInt(b.puzzleKey.split("_")[2], 10);
              return numA - numB;
            });
          setLevels(items);
          setStatus('drafting');
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (status !== 'drafting' || levels.length === 0) return;

    const activeLvl = levels[tombIdx];
    if (!activeLvl) return;

    setGrid(prev => {
      const next = prev.map((row, ri) => 
        row.map((cell, ci) => (ri === r && ci === c) ? (cell + 1) % 5 : cell)
      );

      // Verify grid match via API POST!
      const gridString = next.map(row => row.join(",")).join("|");
      
      fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "01",
          puzzleKey: activeLvl.puzzleKey,
          answer: gridString
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.correct) {
          setStatus('success');
          setTimeout(() => {
            if (tombIdx === levels.length - 1) {
              setStatus('completed');
              setTimeout(onSolve, 1000);
            } else {
              setTombIdx(prev => prev + 1);
              setGrid([
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0]
              ]);
              setStatus('drafting');
            }
          }, 1000);
        }
      })
      .catch(err => console.error(err));

      return next;
    });
  };

  const currentBlueprint = levels[tombIdx]?.grid;
  const currentBlueprintName = levels[tombIdx]?.name || "";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
      <p className="question-text" style={{ marginBottom: '0.2rem', fontSize: '1rem', lineHeight: 1.4 }}>
        {status === 'loading' && "Loading blueprints..."}
        {status === 'drafting' && `CONSTRUCTION: Blueprint ${tombIdx + 1} of ${levels.length}`}
        {status === 'success' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>BLUEPRINT ALIGNED! COMMENCING NEXT PHASE...</span>}
        {status === 'completed' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>ALL TOMBS SECURED - SACRED BALANCE RESTORED!</span>}
      </p>

      {/* Blueprint Visual Reference */}
      {currentBlueprint && (
        <div style={{
          background: 'rgba(10, 8, 7, 0.95)',
          border: '1px dashed var(--color-accent)',
          padding: '10px 14px',
          borderRadius: '4px',
          fontSize: '0.8rem',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}>
          <div style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>
            OBJECTIVE: {currentBlueprintName.toUpperCase()}
          </div>
          <div style={{ fontFamily: 'monospace', whiteSpace: 'pre', lineHeight: 1.3, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            {getBlueprintText(currentBlueprint)}
          </div>
        </div>
      )}

      {/* Build Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        width: '100%',
        maxWidth: '220px',
        aspectRatio: '1/1',
        margin: '0 auto'
      }}>
        {grid.map((row, r) => 
          row.map((cell, c) => {
            const blockName = BLOCK_NAMES[cell];
            const borderCol = BLOCK_BORDER_COLORS[cell];
            const bg = BLOCK_COLORS[cell];
            const isTargetCorrect = currentBlueprint && cell === currentBlueprint[r][c] && cell !== 0;

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: bg,
                  border: `2px ${cell === 0 ? 'dashed' : 'solid'} ${borderCol}`,
                  borderRadius: '6px',
                  cursor: status === 'drafting' ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  aspectRatio: '1/1',
                  userSelect: 'none',
                  position: 'relative',
                  boxShadow: isTargetCorrect ? 'inset 0 0 10px rgba(46, 204, 113, 0.2)' : 'none'
                }}
              >
                {cell > 0 && (
                  <span style={{ 
                    fontSize: '1.4rem', 
                    lineHeight: 1 
                  }}>
                    {blockName.split(" ")[0]}
                  </span>
                )}
                {cell > 0 && (
                  <span style={{ 
                    fontSize: '0.5rem', 
                    fontFamily: 'monospace', 
                    color: isTargetCorrect ? 'var(--color-success)' : 'var(--color-text-muted)',
                    marginTop: '2px',
                    textAlign: 'center',
                    fontWeight: isTargetCorrect ? 'bold' : 'normal'
                  }}>
                    {blockName.split(" ")[1]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- SEAL REVEAL LOGIC ---
interface SealType {
  name: string;
  char: string;
  desc: string;
  puzzleKey: string;
}

interface SealRevealPuzzleProps {
  onSolve: () => void;
}

function SealRevealPuzzle({ onSolve }: SealRevealPuzzleProps) {
  const [seals, setSeals] = useState<SealType[]>([]);
  const [targetIdx, setTargetIdx] = useState<number>(0);
  const [cleanedCells, setCleanedCells] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<'cleaning' | 'identifying' | 'success' | 'failed' | 'loading'>('loading');
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/questions?caseId=01")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const items = data.questions
            .filter((q: any) => q.puzzleKey.startsWith("seal_reveal_"))
            .map((q: any) => {
              const parsed = JSON.parse(q.question);
              return {
                name: parsed.name,
                char: parsed.char,
                desc: parsed.desc,
                puzzleKey: q.puzzleKey
              };
            });
          setSeals(items);
          if (items.length > 0) {
            const randomIdx = Math.floor(Math.random() * items.length);
            setTargetIdx(randomIdx);
          }
          setPhase('cleaning');
        }
      })
      .catch(err => console.error(err));
  }, []);

  const totalCells = 64; // 8x8 grid
  const cleanedCount = Object.keys(cleanedCells).length;
  const percentCleared = Math.min(100, Math.floor((cleanedCount / totalCells) * 100));

  const cleanCell = (r: number, c: number) => {
    if (phase !== 'cleaning') return;
    const key = `${r},${c}`;
    if (cleanedCells[key]) return;

    setCleanedCells(prev => {
      const next = { ...prev, [key]: true };
      const nextClearedCount = Object.keys(next).length;
      if (nextClearedCount >= 58) { // >90% cleared
        setPhase('identifying');
      }
      return next;
    });
  };

  const handleMouseUp = () => setIsMouseDown(false);
  const handleMouseDown = () => setIsMouseDown(true);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleIdentification = async (selectedName: string) => {
    if (phase !== 'identifying' || seals.length === 0) return;

    const activeSeal = seals[targetIdx];
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "01",
          puzzleKey: activeSeal.puzzleKey,
          answer: selectedName
        })
      });
      const data = await res.json();
      if (data.success && data.correct) {
        setPhase('success');
        setTimeout(onSolve, 1500);
      } else {
        setPhase('failed');
        setTimeout(() => {
          // Reset puzzle with a new seal
          const nextIdx = (targetIdx + Math.floor(Math.random() * (seals.length - 1)) + 1) % seals.length;
          setTargetIdx(nextIdx);
          setCleanedCells({});
          setPhase('cleaning');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setPhase('failed');
    }
  };

  const targetSeal = seals[targetIdx];

  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0.8rem' }}
      onMouseDown={handleMouseDown}
    >
      <p className="question-text" style={{ marginBottom: '0.2rem', fontSize: '0.95rem', lineHeight: 1.4 }}>
        {phase === 'loading' && "Loading ancient seal parameters..."}
        {phase === 'cleaning' && `CLEANING DUST: ${percentCleared}% Cleared (Wipe over the sand to reveal the seal)`}
        {phase === 'identifying' && <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>SEAL REVEALED! IDENTIFY THE GLYPH TO AUTHENTICATE:</span>}
        {phase === 'success' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>ACCESS GRANTED - SEAL AUTHENTICATED!</span>}
        {phase === 'failed' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>ERROR: INCORRECT GLYPH. RE-DUSTING SEAL...</span>}
      </p>

      {/* Grid Cavern Container */}
      <div style={{
        position: 'relative',
        width: '240px',
        height: '240px',
        background: '#120e0a',
        border: '2px solid var(--color-accent)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
      }}>
        {/* Underlay: Glowing Gold Seal Glyph */}
        <div style={{
          fontSize: '7rem',
          fontFamily: 'serif',
          color: 'rgba(212, 175, 55, 0.95)',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textShadow: '0 0 15px rgba(212, 175, 55, 0.6)',
          transition: 'all 0.5s ease',
          transform: phase === 'success' ? 'scale(1.15)' : 'scale(1)'
        }}>
          {targetSeal?.char}
        </div>

        {/* Overlay: Dust Blocks */}
        {phase === 'cleaning' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gridTemplateRows: 'repeat(8, 1fr)',
            gap: '1px'
          }}>
            {Array.from({ length: 64 }).map((_, idx) => {
              const r = Math.floor(idx / 8);
              const c = idx % 8;
              const cellKey = `${r},${c}`;
              const isCleaned = cleanedCells[cellKey];

              return (
                <div
                  key={cellKey}
                  onMouseEnter={() => {
                    if (isMouseDown) {
                      cleanCell(r, c);
                    }
                  }}
                  onMouseDown={() => {
                    cleanCell(r, c);
                  }}
                  onTouchStart={() => {
                    cleanCell(r, c);
                  }}
                  onTouchMove={(e) => {
                    // Mobile swipe support
                    const touch = e.touches[0];
                    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (elem && elem.getAttribute('data-dust-cell')) {
                      const [tr, tc] = elem.getAttribute('data-dust-cell')!.split(',').map(Number);
                      cleanCell(tr, tc);
                    }
                  }}
                  data-dust-cell={cellKey}
                  style={{
                    background: isCleaned ? 'transparent' : '#524332',
                    border: isCleaned ? 'none' : '1px solid #3d3124',
                    opacity: isCleaned ? 0 : 0.96,
                    cursor: 'crosshair',
                    transition: 'opacity 0.2s ease-out, background 0.2s ease-out'
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Identification Phase UI */}
      {phase === 'identifying' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          width: '100%',
          maxWidth: '320px',
          marginTop: '0.4rem'
        }}>
          {seals.map(seal => (
            <button
              key={seal.name}
              onClick={() => handleIdentification(seal.name)}
              className="basic-btn"
              style={{
                padding: '8px 4px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            >
              {seal.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- PAPYRUS RESTORE LOGIC ---
interface PapyrusRestorePuzzleProps {
  onSolve: () => void;
}

interface MappedVerse {
  text: string;
  originalIdx: number;
}

function PapyrusRestorePuzzle({ onSolve }: PapyrusRestorePuzzleProps) {
  const [verses, setVerses] = useState<MappedVerse[]>([]);
  const [status, setStatus] = useState<'sorting' | 'success' | 'failed' | 'loading'>('loading');

  // Shuffle on mount
  useEffect(() => {
    fetch("/api/questions?caseId=01&puzzleKey=papyrus_restore")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.questions.length > 0) {
          const parsed: string[] = JSON.parse(data.questions[0].question);
          let shuffled = parsed.map((v, idx) => ({ text: v, originalIdx: idx }));
          while (true) {
            shuffled = shuffled.sort(() => Math.random() - 0.5);
            const isCorrect = shuffled.every((val, idx) => val.text === parsed[idx]);
            if (!isCorrect) break;
          }
          setVerses(shuffled);
          setStatus('sorting');
        }
      })
      .catch(err => console.error(err));
  }, []);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (status !== 'sorting') return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= verses.length) return;

    setVerses(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const checkSequence = async () => {
    if (status !== 'sorting') return;

    const sequenceString = verses.map(v => v.originalIdx).join(",");

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "01",
          puzzleKey: "papyrus_restore",
          answer: sequenceString
        })
      });
      const data = await res.json();
      if (data.success && data.correct) {
        setStatus('success');
        setTimeout(onSolve, 1500);
      } else {
        setStatus('failed');
        setTimeout(() => {
          setStatus('sorting');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setStatus('failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
      <p className="question-text" style={{ marginBottom: '0.2rem', fontSize: '0.95rem', lineHeight: 1.4 }}>
        {status === 'loading' && "Loading scroll fragments..."}
        {status === 'sorting' && "Arrange the jumbled papyrus verses in the correct chronological order:"}
        {status === 'success' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>PAPYRUS SECURED - TRANSLATION COMMITTED!</span>}
        {status === 'failed' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>FRAGMENTS MISALIGNED - Sequence is incoherent.</span>}
      </p>

      {/* Verses Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {verses.map((verse, index) => (
          <div
            key={verse.originalIdx}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(230, 207, 166, 0.95)',
              border: '1px solid #c49a6c',
              borderRadius: '6px',
              padding: '8px 12px',
              gap: '12px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Reorder Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                type="button"
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0 || status !== 'sorting'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: index === 0 ? '#b09473' : '#4a2f13',
                  fontSize: '1rem',
                  cursor: index === 0 ? 'default' : 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 'down')}
                disabled={index === verses.length - 1 || status !== 'sorting'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: index === verses.length - 1 ? '#b09473' : '#4a2f13',
                  fontSize: '1rem',
                  cursor: index === verses.length - 1 ? 'default' : 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ▼
              </button>
            </div>

            {/* Verse Text Card */}
            <div style={{
              flex: 1,
              fontFamily: 'Georgia, serif',
              fontSize: '0.85rem',
              color: '#4a2f13',
              lineHeight: 1.3,
              userSelect: 'none'
            }}>
              "{verse.text}"
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={checkSequence}
          className="basic-btn primary-btn"
          style={{ padding: '8px 24px', fontSize: '0.85rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
          disabled={status !== 'sorting'}
        >
          Restore Papyrus
        </button>
      </div>
    </div>
  );
}

// --- TEMPLE PRESSURE PLATES LOGIC ---
const PRESSURE_PLATES_GRID = [
  ['☉', '☽', '⭐'],
  ['𓅓', '𓃠', '𓆗'],
  ['🌊', '⛰️', '🔥']
];

interface PressurePlatesPuzzleProps {
  onSolve: () => void;
}

function PressurePlatesPuzzle({ onSolve }: PressurePlatesPuzzleProps) {
  const [levels, setLevels] = useState<{ clue: string; sequence: string[]; puzzleKey: string }[]>([]);
  const [levelIdx, setLevelIdx] = useState<number>(0);
  const [activeSequence, setActiveSequence] = useState<string[]>([]);
  const [status, setStatus] = useState<'playing' | 'success' | 'error' | 'completed' | 'loading'>('loading');

  useEffect(() => {
    fetch("/api/questions?caseId=01")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const items = data.questions
            .filter((q: any) => q.puzzleKey.startsWith("pressure_plates_"))
            .map((q: any) => {
              // Extract sequence from clue string using parentheses
              const sequence = q.question.match(/\(([^)]+)\)/g)?.map((s: string) => s.slice(1, -1)) || [];
              return {
                clue: q.question,
                sequence,
                puzzleKey: q.puzzleKey
              };
            })
            .sort((a: any, b: any) => {
              const numA = parseInt(a.puzzleKey.split("_")[2], 10);
              const numB = parseInt(b.puzzleKey.split("_")[2], 10);
              return numA - numB;
            });
          setLevels(items);
          setStatus('playing');
        }
      })
      .catch(err => console.error(err));
  }, []);

  const currentLevel = levels[levelIdx];

  const handlePlateClick = async (symbol: string) => {
    if (status !== 'playing' || !currentLevel) return;

    const nextIdx = activeSequence.length;
    const expectedSymbol = currentLevel.sequence[nextIdx];

    if (symbol === expectedSymbol) {
      const nextSeq = [...activeSequence, symbol];
      setActiveSequence(nextSeq);

      if (nextSeq.length === currentLevel.sequence.length) {
        setStatus('success');
        
        try {
          const answerString = nextSeq.join(",");
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              caseId: "01",
              puzzleKey: currentLevel.puzzleKey,
              answer: answerString
            })
          });
          const data = await res.json();
          if (data.success && data.correct) {
            setTimeout(() => {
              if (levelIdx === levels.length - 1) {
                setStatus('completed');
                setTimeout(onSolve, 1000);
              } else {
                setLevelIdx(prev => prev + 1);
                setActiveSequence([]);
                setStatus('playing');
              }
            }, 1000);
          } else {
            setStatus('error');
            setTimeout(() => {
              setActiveSequence([]);
              setStatus('playing');
            }, 1200);
          }
        } catch (err) {
          console.error(err);
          setStatus('error');
          setTimeout(() => {
            setActiveSequence([]);
            setStatus('playing');
          }, 1200);
        }
      }
    } else {
      setStatus('error');
      setTimeout(() => {
        setActiveSequence([]);
        setStatus('playing');
      }, 1200);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
      <p className="question-text" style={{ marginBottom: '0.2rem', fontSize: '0.95rem', lineHeight: 1.4 }}>
        {status === 'loading' && "Loading pressure plate trials..."}
        {status === 'playing' && `TRIAL: Sequence ${levelIdx + 1} of ${levels.length}`}
        {status === 'error' && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>PLATE TRIGGERED A TRAP! RESETTING TILES...</span>}
        {status === 'success' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>SEQUENCE ALIGNED! FLOORS SHIFTING...</span>}
        {status === 'completed' && <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>CHAMBER UNLOCKED - PRESSURE SECURED!</span>}
      </p>

      {/* Cryptic Wall Carving Clue */}
      {currentLevel && (
        <div style={{
          background: 'rgba(10, 8, 7, 0.95)',
          border: '1px double var(--color-accent)',
          padding: '12px 16px',
          borderRadius: '6px',
          width: '100%',
          boxShadow: 'inset 0 0 10px rgba(212,175,55,0.1)'
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-accent)',
            fontWeight: 'bold',
            letterSpacing: '1px',
            marginBottom: '4px',
            textTransform: 'uppercase'
          }}>
            Ancient Wall Carvings
          </div>
          <p style={{
            fontSize: '0.85rem',
            fontStyle: 'italic',
            color: 'var(--color-text-muted)',
            margin: 0,
            lineHeight: 1.4
          }}>
            "{currentLevel.clue}"
          </p>
        </div>
      )}

      {/* Grid of Pressure Plates */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        width: '100%',
        maxWidth: '220px',
        aspectRatio: '1/1',
        margin: '0.5rem auto'
      }}>
        {PRESSURE_PLATES_GRID.map((row, r) =>
          row.map((symbol, c) => {
            const isPressed = activeSequence.includes(symbol);
            let borderStyle = '2px solid rgba(212, 175, 55, 0.4)';
            let bg = 'rgba(20, 16, 12, 0.9)';
            let color = 'var(--color-text-muted)';
            let shadow = 'none';

            if (isPressed) {
              borderStyle = '2px solid var(--color-success)';
              bg = 'rgba(46, 204, 113, 0.15)';
              color = 'var(--color-success)';
              shadow = '0 0 8px rgba(46, 204, 113, 0.4)';
            } else if (status === 'error' && activeSequence[activeSequence.length - 1] === symbol) {
              borderStyle = '2px solid var(--color-danger)';
              bg = 'rgba(231, 76, 60, 0.15)';
              color = 'var(--color-danger)';
              shadow = '0 0 8px rgba(231, 76, 60, 0.4)';
            }

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handlePlateClick(symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: bg,
                  border: borderStyle,
                  borderRadius: '8px',
                  fontSize: '1.8rem',
                  cursor: status === 'playing' && !isPressed ? 'pointer' : 'default',
                  userSelect: 'none',
                  aspectRatio: '1/1',
                  transition: 'all 0.2s ease',
                  boxShadow: shadow
                }}
              >
                {symbol}
              </div>
            );
          })
        )}
      </div>

      {/* Progress Lights */}
      {currentLevel && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '0.2rem' }}>
          {currentLevel.sequence.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: idx < activeSequence.length ? 'var(--color-success)' : 'rgba(212, 175, 55, 0.2)',
                boxShadow: idx < activeSequence.length ? '0 0 6px var(--color-success)' : 'none',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- MAIN WRAPPER ---
interface Puzzle {
  type: string;
  pattern?: number[];
  question?: string;
  answer?: string;
  sequenceLength?: number;
  targetWeight?: number;
  puzzleKey?: string;
}

interface ActiveAnomaly {
  key: string;
  id?: string;
  puzzles?: Puzzle[];
  type?: string;
  pattern?: number[];
  question?: string;
  answer?: string;
  sequenceLength?: number;
  targetWeight?: number;
  puzzleKey?: string;
}

export function TypewriterText({ text, speed = 25, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isDone, setIsDone] = useState(false);
  
  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    setIsDone(false);
    
    if (!text) {
      setIsDone(true);
      if (onComplete) onComplete();
      return;
    }

    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      if (index >= text.length) {
        clearInterval(interval);
        setIsDone(true);
        if (onComplete) onComplete();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span style={{ whiteSpace: "pre-line", fontFamily: 'monospace' }}>
      {displayedText}
      {!isDone && <span className="terminal-cursor" style={{
        display: 'inline-block',
        width: '8px',
        height: '15px',
        background: 'var(--color-accent)',
        marginLeft: '4px',
        animation: 'terminal-cursor-blink 0.8s infinite'
      }} />}
      <style>{`
        @keyframes terminal-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}

const SNIPPETS: Record<string, { title: string; body: string }> = {
  a1: {
    title: "STAGE 1 — THE HIDDEN SEAL",
    body: "The entrance seal\nwas buried beneath\ncenturies of sand.\n\nOnly the true symbol\ncould unlock the passage.\n\nReveal the glyph.\n\nIdentify it."
  },
  a2: {
    title: "STAGE 2 — THE SCRIBES' TRIAL",
    body: "The next chamber\ncontained questions.\n\nNot riddles.\n\nKnowledge.\n\nOnly those\nworthy of the archive\ncould proceed."
  },
  a3: {
    title: "STAGE 3 — THE ROYAL TOMB",
    body: "Broken foundations\ncovered the chamber.\n\nThe blueprint\nstill survived.\n\nRebuild the tomb\nexactly as intended."
  },
  a4: {
    title: "STAGE 4 — THE LOST PAPYRUS",
    body: "Five fragments\nof a sacred scroll\nwere recovered.\n\nThe words survived.\n\nTheir order did not.\n\nRestore the record."
  },
  a5: {
    title: "STAGE 5 — THE TEMPLE PATH",
    body: "Ancient carvings\ndescribed a safe route.\n\nOne wrong step\nawakened the temple.\n\nFollow\nthe forgotten path."
  },
  a6: {
    title: "STAGE 6 — THE PRIEST'S RITUAL",
    body: "An abandoned altar\nstill held traces\nof ancient magic.\n\nThe ritual\nrequired precise elements.\n\nChoose wisely."
  },
  a7: {
    title: "STAGE 7 — THE HALL OF WORDS",
    body: "The walls\nwere filled\nwith hidden names.\n\nSome honored kings.\n\nOthers warned\nof the curse.\n\nFind them all."
  },
  a8: {
    title: "STAGE 8 — THE GUARDIAN",
    body: "Only one chamber\nremained sealed.\n\nA silent guardian\naccepted only\nthose who proved\ntheir strategy.\n\nDefeat it."
  }
};

interface QuestionModalProps {
  activeAnomaly: ActiveAnomaly | null;
  solveAnomaly: (key: string) => void;
  closeAnomaly: () => void;
  showMap: boolean;
}

export function QuestionModal({ activeAnomaly, solveAnomaly, closeAnomaly, showMap }: QuestionModalProps) {
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState<number>(0);
  const [prevAnomaly, setPrevAnomaly] = useState<ActiveAnomaly | null>(null);
  const [showSnippet, setShowSnippet] = useState<boolean>(true);
  const [snippetCompleted, setSnippetCompleted] = useState<boolean>(false);

  if (activeAnomaly !== prevAnomaly) {
    setPrevAnomaly(activeAnomaly);
    setCurrentPuzzleIndex(0);
    setShowSnippet(true);
    setSnippetCompleted(false);
  }

  if (!activeAnomaly) return null;

  const puzzles = activeAnomaly.puzzles || [activeAnomaly as Puzzle];
  const currentPuzzle = puzzles[currentPuzzleIndex];

  if (!currentPuzzle) return null;

  const handleSolve = () => {
    if (currentPuzzleIndex < puzzles.length - 1) {
      setCurrentPuzzleIndex(currentPuzzleIndex + 1);
      setShowSnippet(true);
      setSnippetCompleted(false);
    } else {
      solveAnomaly(activeAnomaly.key);
    }
  };

  const snippet = activeAnomaly.id ? SNIPPETS[activeAnomaly.id] : null;

  return (
    <div className="modal-overlay">
      <div className="hud-box modal-box" style={{ maxWidth: '480px', width: '95%', borderColor: 'var(--color-accent)' }}>
        {showSnippet && snippet ? (
          <div>
            <h2 className="modal-title" style={{ color: 'var(--color-accent)' }}>
              {snippet.title}
            </h2>
            <div className="modal-content" style={{ marginTop: '1.2rem', textAlign: 'left', minHeight: '150px' }}>
              <div className="question-text" style={{ fontSize: '1rem', lineHeight: '1.8', letterSpacing: '1px' }}>
                <TypewriterText 
                  text={snippet.body} 
                  speed={25} 
                  onComplete={() => setSnippetCompleted(true)} 
                />
              </div>
              
              <div className="modal-actions" style={{ marginTop: '2.5rem' }}>
                {snippetCompleted && (
                  <button 
                    type="button" 
                    onClick={() => setShowSnippet(false)} 
                    className="basic-btn primary-btn"
                  >
                    ACCESS ANOMALY
                  </button>
                )}
                <button type="button" onClick={closeAnomaly} className="basic-btn secondary-btn">
                  Abort
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h2 className="modal-title">
              ANOMALY DETECTED {puzzles.length > 1 && `(${currentPuzzleIndex + 1}/${puzzles.length})`}
            </h2>
            <div className="modal-content">
              
              {currentPuzzle.type === 'lights_out' && <LightsOutPuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} activeAnomaly={currentPuzzle} onSolve={handleSolve} />}
              {currentPuzzle.type === 'weight_balance' && <WeightBalancePuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} anomalyKey={activeAnomaly.key} onSolve={handleSolve} />}
              {currentPuzzle.type === 'sequence' && <SequencePuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} activeAnomaly={currentPuzzle} onSolve={handleSolve} />}
              {currentPuzzle.type === 'tic_tac_toe' && <TicTacToePuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}
              {currentPuzzle.type === 'word_find' && <WordFindPuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}
              {currentPuzzle.type === 'tech_quiz' && <TechQuizPuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}
              {currentPuzzle.type === 'spell_making' && <SpellMakingPuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}
              {currentPuzzle.type === 'tomb_builder' && <TombBuilderPuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}
              {currentPuzzle.type === 'seal_reveal' && <SealRevealPuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}
              {currentPuzzle.type === 'papyrus_restore' && <PapyrusRestorePuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}
              {currentPuzzle.type === 'pressure_plates' && <PressurePlatesPuzzle key={`${activeAnomaly.key}-${currentPuzzleIndex}`} onSolve={handleSolve} />}

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                <button type="button" onClick={closeAnomaly} className="basic-btn secondary-btn">
                  Abort
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
