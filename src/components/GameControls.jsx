"use client"

const GameControls = ({
  onHit,
  onStand,
  onSplit,
  onDoubleDown,
  gameState,
  canHit,
  canSplit,
  canDoubleDown,
}) => {
  return (
    <div className="game-controls">
      {gameState === "playing" && (
        <>
          <button onClick={onHit} className="control-btn hit-btn" disabled={!canHit}>
            Hit
          </button>
          <button onClick={onStand} className="control-btn stand-btn">
            Stand
          </button>

          {canSplit && (
            <button onClick={onSplit} className="control-btn split-btn">
              Split
            </button>
          )}

          {canDoubleDown && (
            <button onClick={onDoubleDown} className="control-btn double-down-btn">
              Double Down
            </button>
          )}
        </>
      )}

      {gameState === "gameOver" && (
        <button onClick={onNewGame} className="control-btn new-game-btn">
          New Game
        </button>
      )}
    </div>
  )
}

export default GameControls
