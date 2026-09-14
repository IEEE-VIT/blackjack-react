"use client"

import { useState, useEffect } from "react"
import Hand from "./components/Hand"
import BettingPanel from "./components/BettingPanel"
import GameControls from "./components/GameControls"
import GameMessage from "./components/GameMessage"
import InsurancePrompt from "./components/InsurancePrompt"
import { createNewDeck, drawCards } from "./utils/deckApi"
import { calculateHandValue, isBlackjack, isBust, shouldDealerHit, determineWinner, canSplit, canDoubleDown } from "./utils/gameLogic"
import "./App.css"

function App() {
  const [deckId, setDeckId] = useState(null)
  const [hands, setHands] = useState([{ id: 1, cards: [], bet: 0, status: 'playing' }])
  const [activeHandIndex, setActiveHandIndex] = useState(0)
  const [dealerCards, setDealerCards] = useState([])
  const [money, setMoney] = useState(1000)
  const [insuranceBet, setInsuranceBet] = useState(0)
  const [gameState, setGameState] = useState("betting") // 'betting', 'insurancePrompt', 'playing', 'dealerTurn', 'gameOver'
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("")
  const [nextHandId, setNextHandId] = useState(2)

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

    setMoney(money - betAmount)
    await dealInitialCards(betAmount)
  }

  const dealInitialCards = async (initialBet) => {
    try {
      const cards = await drawCards(deckId, 4)
      const playerInitialCards = [cards[0], cards[2]]
      const dealerInitialCards = [cards[1], cards[3]]

      setHands([{ id: 1, cards: playerInitialCards, bet: initialBet, status: 'playing' }])
      setActiveHandIndex(0)
      setNextHandId(2)
      setInsuranceBet(0)
      setDealerCards(dealerInitialCards)
      setMessage("")

      const dealerUpCard = dealerInitialCards[1]
      const dealerShowsAce = dealerUpCard.value === "ACE"
      const maxInsurance = Math.floor(initialBet / 2)
      const remainingMoney = money - initialBet

      // Offer insurance if dealer shows Ace and player has funds left to cover it
      if (dealerShowsAce && maxInsurance > 0 && remainingMoney >= maxInsurance) {
        setGameState("insurancePrompt")
        return
      }

      // If no insurance prompt, standard game continuation
      proceedAfterInsurance(playerInitialCards, dealerInitialCards, 0)
    } catch (error) {
      console.error("Failed to deal cards:", error)
      setMessage("Failed to deal cards. Please try again.")
      setMessageType("error")
    }
  }

  const handleInsuranceChoice = (buyInsurance) => {
    let cost = 0
    if (buyInsurance) {
      cost = Math.floor(hands[0].bet / 2)
      setInsuranceBet(cost)
      setMoney((prevMoney) => prevMoney - cost)
    }
    proceedAfterInsurance(hands[0].cards, dealerCards, cost)
  }

  const proceedAfterInsurance = (pCards, dCards, activeInsurance) => {
    const playerHasBJ = isBlackjack(pCards)
    const dealerHasBJ = isBlackjack(dCards)

    // Check immediate Blackjack conditions
    if (playerHasBJ || dealerHasBJ) {
      let result = "push"
      if (playerHasBJ && dealerHasBJ) {
        result = "push"
      } else if (playerHasBJ) {
        result = "blackjack"
      } else {
        result = "dealer"
      }
      endGame([result], activeInsurance, dCards)
    } else {
      setGameState("playing")
    }
  }

  const hit = async () => {
    try {
      const newCards = await drawCards(deckId, 1)
      const updatedHands = [...hands]
      updatedHands[activeHandIndex].cards = [...updatedHands[activeHandIndex].cards, ...newCards]
      setHands(updatedHands)

      if (isBust(updatedHands[activeHandIndex].cards)) {
        // Move to next hand
        if (activeHandIndex < hands.length - 1) {
          setActiveHandIndex(activeHandIndex + 1)
        } else {
          // All hands are bust or completed, proceed to dealer turn
          endRoundIfAllHandsResolved(updatedHands)
        }
      }
    } catch (error) {
      console.error("Failed to draw card:", error)
    }
  }

  const stand = () => {
    if (activeHandIndex < hands.length - 1) {
      setActiveHandIndex(activeHandIndex + 1)
    } else {
      setGameState("dealerTurn")
      dealerPlay()
    }
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

      // Determine results for all hands
      const results = hands.map((hand) => determineWinner(hand.cards, currentDealerCards))
      endGame(results, insuranceBet, currentDealerCards)
    } catch (error) {
      console.error("Dealer play error:", error)
    }
  }

  const endGame = (winners, currentInsurance = insuranceBet, finalDealerCards = dealerCards) => {
    setGameState("gameOver")

    // Calculate Insurance payout (2:1 if Dealer has Blackjack)
    let insuranceWinnings = 0
    let insuranceMsg = ""
    if (currentInsurance > 0) {
      if (isBlackjack(finalDealerCards)) {
        insuranceWinnings = currentInsurance * 3 // Original insurance bet + 2:1 payout
        insuranceMsg = ` (Insurance Pays +$${currentInsurance * 2})`
      } else {
        insuranceMsg = ` (Insurance Lost -$${currentInsurance})`
      }
    }

    let winnings = 0
    let msg = []
    let types = []

    // Handle multiple hands
    Array.isArray(winners) && winners.forEach((winner, i) => {
      let w = 0, t = "", m = ""
      const handLabel = hands.length > 1 ? `Hand ${i + 1}` : "Player"
      const bet = hands[i].bet

      switch (winner) {
        case "player":
          w = bet * 2
          m = `${handLabel} wins! +$${bet}`
          t = "win"
          break
        case "blackjack":
          w = Math.floor(bet * 2.5)
          m = `${handLabel} Blackjack! +$${Math.floor(bet * 1.5)}`
          t = "blackjack"
          break
        case "dealer":
          w = 0
          m = `${handLabel} loses! -$${bet}`
          t = "lose"
          break
        case "push":
          w = bet
          m = `${handLabel} push. Bet returned.`
          t = "push"
          break
      }
      winnings += w
      msg.push(m)
      types.push(t)
    })

    setMoney((prevMoney) => prevMoney + winnings + insuranceWinnings)
    setMessage(msg.join(" | ") + insuranceMsg)
    setMessageType(types.join(" "))
  }

  const newGame = () => {
    setHands([{ id: 1, cards: [], bet: 0, status: 'playing' }])
    setActiveHandIndex(0)
    setNextHandId(2)
    setDealerCards([])
    setInsuranceBet(0)
    setGameState("betting")
    setMessage("")
    setMessageType("")
  }

  const endRoundIfAllHandsResolved = (currentHands) => {
    const allResolved = currentHands.every((hand) => 
      isBust(hand.cards) || calculateHandValue(hand.cards) === 21
    )
    if (allResolved) {
      setGameState("dealerTurn")
      dealerPlay()
    }
  }

  let canHit = false
  if (gameState === "playing" && hands.length > 0) {
    const currentHand = hands[activeHandIndex]
    canHit = !isBust(currentHand.cards) && calculateHandValue(currentHand.cards) < 21
  }

  const currentHand = hands.length > 0 ? hands[activeHandIndex] : null
  const showSplit =
    gameState === "playing" &&
    hands.length < 4 &&
    currentHand &&
    canSplit(currentHand.cards) &&
    money >= currentHand.bet
  const showDoubleDown =
    gameState === "playing" &&
    currentHand &&
    currentHand.cards.length === 2 &&
    money >= currentHand.bet
  const canSurrender =
    gameState === "playing" &&
    hands.length === 1 &&
    currentHand &&
    currentHand.cards.length === 2

  const handleSplit = async () => {
    const currentHand = hands[activeHandIndex]
    if (!canSplit(currentHand.cards) || money < currentHand.bet) return

    const newCards = await drawCards(deckId, 2)
    const updatedHands = [...hands]
    updatedHands[activeHandIndex].cards = [currentHand.cards[0], newCards[0]]

    const newHand = {
      id: nextHandId,
      cards: [currentHand.cards[1], newCards[1]],
      bet: currentHand.bet,
      status: 'playing'
    }

    updatedHands.push(newHand)
    setHands(updatedHands)
    setNextHandId(nextHandId + 1)
    setMoney((prevMoney) => prevMoney - currentHand.bet)
  }

  const handleDoubleDown = async () => {
    const currentHand = hands[activeHandIndex]
    if (currentHand.cards.length !== 2 || money < currentHand.bet) return

    const newCards = await drawCards(deckId, 1)
    const updatedHands = [...hands]
    updatedHands[activeHandIndex].cards = [...currentHand.cards, ...newCards]
    updatedHands[activeHandIndex].bet = currentHand.bet * 2
    setHands(updatedHands)
    setMoney((prevMoney) => prevMoney - currentHand.bet)

    // After double down, move to next hand or dealer turn
    if (activeHandIndex < hands.length - 1) {
      setActiveHandIndex(activeHandIndex + 1)
    } else {
      setGameState("dealerTurn")
      dealerPlay()
    }
  }

  const handleSurrender = () => {
    const currentHand = hands[activeHandIndex]
    if (gameState !== "playing" || currentHand.cards.length !== 2 || hands.length > 1) return

    const refundAmount = Math.floor(currentHand.bet / 2)
    setMoney((prevMoney) => prevMoney + refundAmount)
    setGameState("gameOver")
    setMessage(`Surrendered! Half bet returned (+$${refundAmount})`)
    setMessageType("push")
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
            currentBet={hands.length > 0 ? hands[0].bet : 0}
            onPlaceBet={placeBet}
            gameInProgress={gameState !== "betting"}
          />
        </aside>
        <div className="game-center">
          <header className="game-header minimalist-header"></header>
          <div className="game-area minimalist-area">
            <Hand
              cards={dealerCards}
              title="Dealer"
              hideFirstCard={gameState === "playing" || gameState === "insurancePrompt"}
              showValue={gameState !== "playing" && gameState !== "insurancePrompt"}
            />
            <GameMessage message={message} type={messageType} />
            {hands.map((hand, index) => (
              <Hand
                key={hand.id}
                cards={hand.cards}
                title={hands.length > 1 ? `Hand ${index + 1}` : "Player"}
              />
            ))}
          </div>
          <div className="control-area minimalist-controls">
            {gameState === "insurancePrompt" ? (
              <InsurancePrompt
                insuranceAmount={Math.floor(hands[0]?.bet / 2 || 0)}
                onChoice={handleInsuranceChoice}
              />
            ) : (
              <GameControls
                onHit={hit}
                onStand={stand}
                onSplit={handleSplit}
                onDoubleDown={handleDoubleDown}
                onSurrender={handleSurrender}
                onNewGame={newGame}
                gameState={gameState}
                canHit={canHit}
                canSplit={showSplit}
                canDoubleDown={showDoubleDown}
                canSurrender={canSurrender}
              />
            )}
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
