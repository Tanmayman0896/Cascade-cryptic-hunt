import React from 'react';

interface Player {
  x: number;
  y: number;
  facing: number;
}

interface Anomaly {
  id: string;
  solved: boolean;
  puzzles: any[];
}

interface MinimapProps {
  player: Player;
  anomalies: Record<string, Anomaly>;
  allSolved: boolean;
  currentMap: number[][];
}

export function Minimap({ player, anomalies, allSolved, currentMap }: MinimapProps) {
  if (!currentMap) return null;

  const rowsCount = currentMap.length;
  const colsCount = currentMap[0]?.length || 0;
  const gapSize = rowsCount > 20 ? '1px' : '2px';

  return (
    <div 
      className="minimap"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rowsCount}, 1fr)`,
        gridTemplateColumns: `repeat(${colsCount}, 1fr)`,
        gap: gapSize,
        width: rowsCount > 20 ? '280px' : '200px',
        height: rowsCount > 20 ? '280px' : '200px'
      }}
    >
      {currentMap.flatMap((row, y) => 
        row.map((cell, x) => {
          let className = "minimap-cell ";
          if (cell === 1) className += "wall";
          else if (cell === 2) {
            const anomaly = anomalies[`${y},${x}`];
            className += `anomaly ${anomaly?.solved ? 'solved' : ''}`;
          }
          else if (cell === 3) className += `exit ${allSolved ? 'unlocked' : ''}`;
          else if (cell === 4) className += `heart`;
          else className += "path";

          const isPlayerHere = player.x === x && player.y === y;
          const anomaly = cell === 2 ? anomalies[`${y},${x}`] : null;
          let label = "";
          if (anomaly) {
            const num = parseInt(anomaly.id.replace("a", ""), 10);
            if (!isNaN(num)) {
              label = String.fromCharCode(64 + num);
            }
          }

          return (
            <div
              key={`cell-${x}-${y}`}
              className={className}
              style={{
                position: 'relative',
                backgroundColor: cell === 4 ? 'var(--color-accent)' : (cell === 2 ? '#000000' : undefined),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%'
              }}
            >
              {label && (
                <span style={{
                  fontSize: rowsCount > 20 ? '9px' : '11px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: anomaly?.solved ? 'var(--color-success)' : 'var(--color-danger)',
                  lineHeight: 1,
                  zIndex: 2
                }}>
                  {label}
                </span>
              )}
              {isPlayerHere && (
                <div className="minimap-cell player" style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%', height: '60%',
                  zIndex: 3
                }} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

