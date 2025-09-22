"use client"

import { useState, useEffect } from "react"
import Hand from "./components/Hand"
import BettingPanel from "./components/BettingPanel"
import GameControls from "./components/GameControls"
import GameMessage from "./components/GameMessage"
import { createNewDeck, drawCards } from "./utils/deckApi"
import { calculateHandValue, isBlackjack, isBust, shouldDealerHit, determineWinner, canSplit, canDoubleDown } from "./utils/gameLogic"
import "./App.css"

function App() {
  const [deckId, setDeckId] = useState(null)
  const [playerCards, setPlayerCards] = useState([])
  const [splitCards, setSplitCards] = useState(null) // null or array for split hand
  const [activeHand, setActiveHand] = useState("main") // 'main' or 'split'
  const [dealerCards, setDealerCards] = useState([])
  const [money, setMoney] = useState(1000)
  const [currentBet, setCurrentBet] = useState(0)
  const [splitBet, setSplitBet] = useState(0)
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
      setSplitCards(null)
      setActiveHand("main")
      setSplitBet(0)
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
      if (splitCards && activeHand === "split") {
        const updatedSplit = [...splitCards, ...newCards]
        setSplitCards(updatedSplit)
        if (isBust(updatedSplit)) {
          setActiveHand("main")
        }
      } else {
        const updatedPlayerCards = [...playerCards, ...newCards]
        setPlayerCards(updatedPlayerCards)
        if (isBust(updatedPlayerCards)) {
          if (splitCards) {
            setActiveHand("split")
          } else {
            endGame("dealer")
          }
        }
      }
    } catch (error) {
      console.error("Failed to draw card:", error)
    }
  }

  const stand = () => {
    if (splitCards && activeHand === "main") {
      setActiveHand("split")
    } else {
      setGameState("dealerTurn")
      dealerPlay()
    }
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

      // If split, resolve both hands
      if (splitCards) {
        const mainResult = determineWinner(playerCards, currentDealerCards)
        const splitResult = determineWinner(splitCards, currentDealerCards)
        endGame([mainResult, splitResult])
      } else {
        const winner = determineWinner(playerCards, currentDealerCards)
        endGame(winner)
      }
    } catch (error) {
      console.error("Dealer play error:", error)
    }
  }

  const endGame = (winner) => {
    setGameState("gameOver")

    // If split, winner is array [main, split]
    if (Array.isArray(winner)) {
      let winnings = 0
      let msg = []
      let types = []
      const betArr = [currentBet, splitBet]
      ["Main", "Split"].forEach((label, i) => {
        let w = 0, t = "", m = ""
        switch (winner[i]) {
          case "player":
            w = betArr[i] * 2
            m = `${label} hand wins! +$${betArr[i]}`
            t = "win"
            break
          case "blackjack":
            w = Math.floor(betArr[i] * 2.5)
            m = `${label} hand Blackjack! +$${Math.floor(betArr[i] * 1.5)}`
            t = "blackjack"
            break
          case "dealer":
            w = 0
            m = `${label} hand loses! -$${betArr[i]}`
            t = "lose"
            break
          case "push":
            w = betArr[i]
            m = `${label} hand push. Bet returned.`
            t = "push"
            break
        }
        winnings += w
        msg.push(m)
        types.push(t)
      })
      setMoney(money + winnings)
      setMessage(msg.join(" | "))
      setMessageType(types.join(" "))
      return
    }

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
    setSplitCards(null)
    setActiveHand("main")
    setDealerCards([])
    setCurrentBet(0)
    setSplitBet(0)
    setGameState("betting")
    setMessage("")
    setMessageType("")
  }

  // For split, only allow hit on active hand
  let canHit = false
  if (gameState === "playing") {
    if (splitCards) {
      if (activeHand === "main") {
        canHit = !isBust(playerCards) && calculateHandValue(playerCards) < 21
      } else {
        canHit = !isBust(splitCards) && calculateHandValue(splitCards) < 21
      }
    } else {
      canHit = !isBust(playerCards) && calculateHandValue(playerCards) < 21
    }
  }

  // Show split if allowed
  const showSplit = gameState === "playing" && !splitCards && canSplit(playerCards) && money >= currentBet
  // Show double down if allowed (only on first move of each hand)
  const showDoubleDown = gameState === "playing" && (
    (!splitCards && canDoubleDown(playerCards, money, currentBet)) ||
    (splitCards && activeHand === "main" && playerCards.length === 2 && canDoubleDown(playerCards, money, currentBet)) ||
    (splitCards && activeHand === "split" && splitCards.length === 2 && canDoubleDown(splitCards, money, splitBet))
  )

  // Split handler
  const handleSplit = async () => {
    if (!canSplit(playerCards) || money < currentBet) return
    // Move one card to split hand, draw one for each
    const newCards = await drawCards(deckId, 2)
    setPlayerCards([playerCards[0], newCards[0]])
    setSplitCards([playerCards[1], newCards[1]])
    setSplitBet(currentBet)
    setMoney(money - currentBet)
    setActiveHand("main")
  }

  // Double down handler
  const handleDoubleDown = async () => {
    if (splitCards) {
      if (activeHand === "main" && playerCards.length === 2 && money >= currentBet) {
        const newCards = await drawCards(deckId, 1)
        const updated = [...playerCards, ...newCards]
        setPlayerCards(updated)
        setMoney(money - currentBet)
        setCurrentBet(currentBet * 2)
        setActiveHand("split")
      } else if (activeHand === "split" && splitCards.length === 2 && money >= splitBet) {
        const newCards = await drawCards(deckId, 1)
        const updated = [...splitCards, ...newCards]
        setSplitCards(updated)
        setMoney(money - splitBet)
        setSplitBet(splitBet * 2)
        setGameState("dealerTurn")
        dealerPlay()
      }
    } else if (playerCards.length === 2 && money >= currentBet) {
      const newCards = await drawCards(deckId, 1)
      const updated = [...playerCards, ...newCards]
      setPlayerCards(updated)
      setMoney(money - currentBet)
      setCurrentBet(currentBet * 2)
      setGameState("dealerTurn")
      dealerPlay()
    }
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
          </header>
          <div className="game-area minimalist-area">
            <Hand
              cards={dealerCards}
              title="Dealer"
              hideFirstCard={gameState === "playing"}
              showValue={gameState !== "playing"}
            />
            <GameMessage message={message} type={messageType} />
            <Hand cards={playerCards} title={splitCards ? (activeHand === "main" ? "Player (Main)" : "Player (Main)") : "Player"} />
            {splitCards && <Hand cards={splitCards} title={activeHand === "split" ? "Player (Split)" : "Player (Split)"} />}
          </div>
          <div className="control-area minimalist-controls">
            <GameControls
              onHit={hit}
              onStand={stand}
              onSplit={handleSplit}
              onDoubleDown={handleDoubleDown}
              onNewGame={newGame}
              gameState={gameState}
              canHit={canHit}
              canSplit={showSplit}
              canDoubleDown={showDoubleDown}
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
