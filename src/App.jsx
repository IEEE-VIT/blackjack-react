"use client"

import { useState, useEffect } from "react"
import Hand from "./components/Hand"
import BettingPanel from "./components/BettingPanel"
import GameControls from "./components/GameControls"
import GameMessage from "./components/GameMessage"
import TitleScreen from "./components/TitleScreen" // New component to add
import { createNewDeck, drawCards } from "./utils/deckApi"
import { calculateHandValue, isBlackjack, isBust, shouldDealerHit, determineWinner } from "./utils/gameLogic"
import "./App.css"

function App() {
  const INITIAL_MONEY = 1000
  const [showTitle, setShowTitle] = useState(true)
  const [deckId, setDeckId] = useState(null)
  const [playerCards, setPlayerCards] = useState([])
  const [dealerCards, setDealerCards] = useState([])
  const [money, setMoney] = useState(INITIAL_MONEY)
  const [currentBet, setCurrentBet] = useState(0)
  const [gameState, setGameState] = useState("betting") // 'betting', 'playing', 'dealerTurn', 'gameOver'
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

  const startGame = () => {
    setMoney(INITIAL_MONEY)
    setShowTitle(false)
    newGame()
  }

  const quitGame = () => {
    setShowTitle(true)
    newGame()
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

      // Check for immediate blackjack
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
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Delay for animation
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

  if (showTitle) {
    return (
      <TitleScreen onStart={startGame} />
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
            <button className="quit-btn" onClick={quitGame}>Quit</button>
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
            <GameControls onHit={hit} onStand={stand} onNewGame={newGame} gameState={gameState} canHit={canHit} />
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
                setMoney(INITIAL_MONEY)
                newGame()
                setShowTitle(true)
              }}
              className="restart-btn"
            >
              Start New Game (${INITIAL_MONEY})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
