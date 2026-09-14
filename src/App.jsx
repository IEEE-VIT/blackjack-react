"use client"

import { useState, useEffect, useRef } from "react"
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
  const [hands, setHands] = useState([{ id: 1, cards: [], bet: 0, status: "playing" }])
  const [activeHand, setActiveHand] = useState(0)
  const [dealerCards, setDealerCards] = useState([])
  const [money, setMoney] = useState(1000)
  const [insuranceBet, setInsuranceBet] = useState(0)
  const [gameState, setGameState] = useState("betting") // 'betting', 'insurancePrompt', 'playing', 'dealerTurn', 'gameOver'
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("")
  const hasLoadedMoney = useRef(false)

  useEffect(() => {
    const savedMoney = localStorage.getItem("blackjackMoney")
    if (savedMoney !== null) {
      setMoney(Number(savedMoney))
    }
    hasLoadedMoney.current = true
  }, [])

  useEffect(() => {
    if (!hasLoadedMoney.current) return
    localStorage.setItem("blackjackMoney", String(money))
  }, [money])

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

    const initialHand = { id: 1, cards: [], bet: betAmount, status: "playing" }
    setHands([initialHand])
    setActiveHand(0)
    setMoney(money - betAmount)
    await dealInitialCards(betAmount)
  }

  const dealInitialCards = async (initialBet) => {
    try {
      const cards = await drawCards(deckId, 4)
      const playerInitialCards = [cards[0], cards[2]]
      const dealerInitialCards = [cards[1], cards[3]]
      const initialHands = [{ id: 1, cards: playerInitialCards, bet: initialBet, status: "playing" }]

      setHands(initialHands)
      setActiveHand(0)
      setInsuranceBet(0)
      setDealerCards(dealerInitialCards)
      setMessage("")

      const dealerUpCard = dealerInitialCards[1]
      const dealerShowsAce = dealerUpCard.value === "ACE"
      const maxInsurance = Math.floor(initialBet / 2)

      // Offer insurance if dealer shows Ace and player has funds
      if (dealerShowsAce && money >= maxInsurance) {
        setGameState("insurancePrompt")
        return
      }

      // If no insurance prompt, standard game continuation
      proceedAfterInsurance(initialHands, dealerInitialCards, 0)
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
    proceedAfterInsurance(hands, dealerCards, cost)
  }

  const proceedAfterInsurance = (currentHands, dCards, activeInsurance) => {
    const playerHasBJ = isBlackjack(currentHands[0].cards)
    const dealerHasBJ = isBlackjack(dCards)

    // Check immediate Blackjack conditions
    if (playerHasBJ || dealerHasBJ) {
      if (playerHasBJ && dealerHasBJ) {
        settleHands(currentHands, activeInsurance, dCards)
      } else if (playerHasBJ) {
        settleHands(currentHands, activeInsurance, dCards)
      } else {
        settleHands(currentHands, activeInsurance, dCards)
      }
    } else {
      setGameState("playing")
    }
  }

  const finishHand = (updatedHands, handIndex, status) => {
    const nextHands = updatedHands.map((hand, index) => (
      index === handIndex ? { ...hand, status } : hand
    ))
    const nextHandIndex = nextHands.findIndex((hand, index) => index > handIndex && hand.status === "playing")

    setHands(nextHands)
    if (nextHandIndex !== -1) {
      setActiveHand(nextHandIndex)
    } else {
      setGameState("dealerTurn")
      dealerPlay(nextHands)
    }
  }

  const hit = async () => {
    try {
      const newCards = await drawCards(deckId, 1)
      const current = hands[activeHand]
      const updatedCards = [...current.cards, ...newCards]
      const updatedHands = hands.map((hand, index) => (
        index === activeHand ? { ...hand, cards: updatedCards } : hand
      ))
      if (isBust(updatedCards)) {
        finishHand(updatedHands, activeHand, "bust")
      } else {
        setHands(updatedHands)
      }
    } catch (error) {
      console.error("Failed to draw card:", error)
    }
  }

  const stand = () => {
    finishHand(hands, activeHand, "stood")
  }

  const handleSurrender = () => {
    if (gameState !== "playing" || hands.length !== 1 || hands[0].cards.length !== 2) return

    const refundAmount = Math.floor(hands[0].bet / 2)
    setMoney((currentMoney) => currentMoney + refundAmount)
    setGameState("gameOver")
    setMessage(`Surrendered! Half bet returned (+$${refundAmount})`)
    setMessageType("push")
  }

  const dealerPlay = async (resolvedHands = hands) => {
    let currentDealerCards = [...dealerCards]

    try {
      while (shouldDealerHit(currentDealerCards)) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const newCards = await drawCards(deckId, 1)
        currentDealerCards = [...currentDealerCards, ...newCards]
        setDealerCards(currentDealerCards)
      }

      settleHands(resolvedHands, insuranceBet, currentDealerCards)
    } catch (error) {
      console.error("Dealer play error:", error)
    }
  }

  const settleHands = (resolvedHands, currentInsurance = insuranceBet, finalDealerCards = dealerCards) => {
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
    const msg = []
    const types = []

    resolvedHands.forEach((hand, index) => {
        const winner = determineWinner(hand.cards, finalDealerCards)
        let w = 0, t = "", m = ""
        const label = resolvedHands.length > 1 ? `Hand ${index + 1}` : "You"
        switch (winner) {
          case "player":
            w = hand.bet * 2
            m = `${label} win${label === "You" ? "" : "s"}! +$${hand.bet}`
            t = "win"
            break
          case "blackjack":
            w = Math.floor(hand.bet * 2.5)
            m = `${label} Blackjack! +$${Math.floor(hand.bet * 1.5)}`
            t = "blackjack"
            break
          case "dealer":
            w = 0
            m = `${label} lose${label === "You" ? "" : "s"}! -$${hand.bet}`
            t = "lose"
            break
          case "push":
            w = hand.bet
            m = `${label} push. Bet returned.`
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
    setHands([{ id: 1, cards: [], bet: 0, status: "playing" }])
    setActiveHand(0)
    setDealerCards([])
    setInsuranceBet(0)
    setGameState("betting")
    setMessage("")
    setMessageType("")
  }

  const currentBet = hands[0]?.bet || 0
  const currentHand = hands[activeHand]
  const canHit = gameState === "playing" && currentHand
    ? !isBust(currentHand.cards) && calculateHandValue(currentHand.cards) < 21
    : false
  const showSplit = gameState === "playing" && currentHand && hands.length < 4 &&
    canSplit(currentHand.cards) && money >= currentHand.bet
  const showDoubleDown = gameState === "playing" && currentHand &&
    canDoubleDown(currentHand.cards, money, currentHand.bet)
  const canSurrender = gameState === "playing" && hands.length === 1 &&
    currentHand?.cards.length === 2

  const handleSplit = async () => {
    const hand = hands[activeHand]
    if (!hand || hands.length >= 4 || !canSplit(hand.cards) || money < hand.bet) return
    const newCards = await drawCards(deckId, 2)
    const updatedHand = { ...hand, cards: [hand.cards[0], newCards[0]] }
    const splitHand = { id: Math.max(...hands.map((item) => item.id)) + 1, cards: [hand.cards[1], newCards[1]], bet: hand.bet, status: "playing" }
    const updatedHands = [
      ...hands.slice(0, activeHand),
      updatedHand,
      splitHand,
      ...hands.slice(activeHand + 1),
    ]
    setHands(updatedHands)
    setMoney((prevMoney) => prevMoney - hand.bet)
  }

  const handleDoubleDown = async () => {
    const hand = hands[activeHand]
    if (!hand || !canDoubleDown(hand.cards, money, hand.bet)) return
    const newCards = await drawCards(deckId, 1)
    const updatedHands = hands.map((item, index) => (
      index === activeHand
        ? { ...item, cards: [...item.cards, ...newCards], bet: item.bet * 2 }
        : item
    ))
    setMoney((prevMoney) => prevMoney - hand.bet)
    finishHand(updatedHands, activeHand, "doubled")
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
                title={hands.length > 1 ? `Player (Hand ${index + 1})` : "Player"}
              />
            ))}
          </div>
          <div className="control-area minimalist-controls">
            {gameState === "insurancePrompt" ? (
              <InsurancePrompt
                insuranceAmount={Math.floor(currentBet / 2)}
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
