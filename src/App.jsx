"use client"

import { useState, useEffect } from "react"
import Hand from "./components/Hand"
import BettingPanel from "./components/BettingPanel"
import GameControls from "./components/GameControls"
import GameMessage from "./components/GameMessage"
import { createNewDeck, drawCards } from "./utils/deckApi"
import { calculateHandValue, isBlackjack, isBust, shouldDealerHit, determineWinner } from "./utils/gameLogic"
import "./App.css"

function App() {
  const [deckId, setDeckId] = useState(null)
  const [playerCards, setPlayerCards] = useState([])
  const [dealerCards, setDealerCards] = useState([])
  const [money, setMoney] = useState(1000)
  const [currentBet, setCurrentBet] = useState(0)
  const [gameState, setGameState] = useState("title") // <-- changed default to "title"
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("")

  useEffect(() => {
    initializeDeck()
  }, [])

  const initializeDeck = async () => {
    try {
      const newDeckId = await createNewDeck()
      setDeckId(newDeckId)
    } catch (error) {
      console.error("Failed to create deck:", error)
      setMessage("Failed to initialize game. Please refresh.")
      setMessageType("error")
    }
  }

  // ---------- NEW: Start Game from Title ----------
  const startGameFromTitle = () => {
    setMoney(1000) // Reset money every new game
    newGame()
    setGameState("betting")
  }

  const placeBet = async (betAmount) => {
    if (betAmount > money) return

    setCurrentBet(betAmount)
    setMoney(money - betAmount)
    await dealInitialCards()
  }

  const dealInitialCards = async () => {
    try {
      const cards = await drawCards(deckId, 4)
      const playerInitialCards = [cards[0], cards[2]]
      const dealerInitialCards = [cards[1], cards[3]]

      setPlayerCards(playerInitialCards)
      setDealerCards(dealerInitialCards)
      setGameState("playing")
      setMessage("")

      if (isBlackjack(playerInitialCards)) {
        if (isBlackjack(dealerInitialCards)) {
          endGame("push")
        } else {
          endGame("blackjack")
        }
      } else if (isBust(playerInitialCards)) {
        endGame("dealer")
      }
    } catch (error) {
      console.error("Failed to deal cards:", error)
      setMessage("Failed to deal cards. Please try again.")
      setMessageType("error")
    }
  }

  const hit = async () => {
    try {
      const newCards = await drawCards(deckId, 1)
      const updatedPlayerCards = [...playerCards, ...newCards]
      setPlayerCards(updatedPlayerCards)

      if (isBust(updatedPlayerCards)) {
        endGame("dealer")
      }
    } catch (error) {
      console.error("Failed to draw card:", error)
    }
  }

  const stand = () => {
    setGameState("dealerTurn")
    dealerPlay()
  }

  const dealerPlay = async () => {
    let currentDealerCards = [...dealerCards]

    try {
      while (shouldDealerHit(currentDealerCards)) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const newCards = await drawCards(deckId, 1)
        currentDealerCards = [...currentDealerCards, ...newCards]
        setDealerCards(currentDealerCards)
      }

      const winner = determineWinner(playerCards, currentDealerCards)
      endGame(winner)
    } catch (error) {
      console.error("Dealer play error:", error)
    }
  }

  const endGame = (winner) => {
    setGameState("gameOver")

    let winnings = 0
    let messageText = ""
    let msgType = ""

    switch (winner) {
      case "player":
        winnings = currentBet * 2
        messageText = `You win! +$${currentBet}`
        msgType = "win"
        break
      case "blackjack":
        winnings = Math.floor(currentBet * 2.5)
        messageText = `Blackjack! +$${Math.floor(currentBet * 1.5)}`
        msgType = "blackjack"
        break
      case "dealer":
        winnings = 0
        messageText = `You lose! -$${currentBet}`
        msgType = "lose"
        break
      case "push":
        winnings = currentBet
        messageText = "Push! Bet returned."
        msgType = "push"
        break
    }

    setMoney(money + winnings)
    setMessage(messageText)
    setMessageType(msgType)
  }

  const newGame = () => {
    setPlayerCards([])
    setDealerCards([])
    setCurrentBet(0)
    setGameState("betting")
    setMessage("")
    setMessageType("")
  }

  const canHit = gameState === "playing" && !isBust(playerCards) && calculateHandValue(playerCards) < 21

  // ------------------- RENDER -------------------
  if (gameState === "title") {
    // ---------- NEW: Title Screen ----------
    return (
      <div className="title-screen">
        <h1 className="fade-in">BLACKJACK-REACT</h1>
        <button className="start-btn" onClick={startGameFromTitle}>
          Start Game ($1000)
        </button>
      </div>
    )
  }

  return (
    <div className="app minimalist">
      <div className="center-title">
        <h1>BlackJack</h1>
      </div>

      <div className="main-container">
        <aside className="betting-sidebar">
          <BettingPanel
            money={money}
            currentBet={currentBet}
            onPlaceBet={placeBet}
            gameInProgress={gameState !== "betting"}
          />
        </aside>

        <div className="game-center">
          <header className="game-header minimalist-header">
            {gameState === "playing" && (
              // ---------- NEW: Quit Button ----------
              <button
                className="quit-btn"
                onClick={() => {
                  setGameState("title")
                  newGame()
                }}
              >
                Quit
              </button>
            )}
          </header>

          <div className="game-area minimalist-area">
            <Hand
              cards={dealerCards}
              title="Dealer"
              hideFirstCard={gameState === "playing"}
              showValue={gameState !== "playing"}
            />
            <GameMessage message={message} type={messageType} />
            <Hand cards={playerCards} title="Player" />
          </div>

          <div className="control-area minimalist-controls">
            <GameControls
              onHit={hit}
              onStand={stand}
              onNewGame={newGame}
              gameState={gameState}
              canHit={canHit}
            />
          </div>
        </div>
      </div>

      {money <= 0 && (
        <div className="game-over-overlay">
          <div className="game-over-message">
            <h2>Game Over!</h2>
            <p>You're out of money!</p>
            <button
              onClick={() => {
                setMoney(1000)
                newGame()
                setGameState("title") // Return to title screen
              }}
              className="restart-btn"
            >
              Start New Game ($1000)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
