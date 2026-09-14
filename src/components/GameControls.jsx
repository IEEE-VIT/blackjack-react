"use client"


const GameControls = ({
  onHit,
  onStand,
  onSplit,
  onDoubleDown,
  onSurrender,
  onNewGame,
  gameState,
  canHit,
  canSplit,
  canDoubleDown,
  canSurrender
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
            <button onClick={onDoubleDown} className="control-btn double-btn">
              Double Down
            </button>
          )}
          {canSurrender && (
            <button onClick={onSurrender} className="control-btn surrender-btn">
              Surrender
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
