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

const STORAGE_KEYS = ["blackjack-balance", "balance"]

const readStoredBalance = () => {
  if (typeof window === "undefined") return 1000

  for (const key of STORAGE_KEYS) {
    const storedValue = Number.parseInt(window.localStorage.getItem(key) ?? "", 10)
    if (!Number.isNaN(storedValue) && storedValue >= 0) {
      return storedValue
    }
  }

  return 1000
}

const persistBalance = (balance) => {
  if (typeof window === "undefined") return

  STORAGE_KEYS.forEach((key) => {
    window.localStorage.setItem(key, String(balance))
  })
}

function App() {
  const [deckId, setDeckId] = useState(null)
  const [hands, setHands] = useState([{ id: 1, cards: [], bet: 0, status: "playing" }])
  const [activeHand, setActiveHand] = useState(0)
  const [dealerCards, setDealerCards] = useState([])
  const [money, setMoney] = useState(() => readStoredBalance())
  const [currentBet, setCurrentBet] = useState(0)
  const [insuranceBet, setInsuranceBet] = useState(0)
  const [gameState, setGameState] = useState("betting") // 'betting', 'insurancePrompt', 'playing', 'dealerTurn', 'gameOver'
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("")

  useEffect(() => {
    initializeDeck()
  }, [])

  useEffect(() => {
    setCurrentBet(hands.reduce((total, hand) => total + hand.bet, 0))
  }, [hands])
    persistBalance(money)
  }, [money])

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

  const createHandId = (currentHands) => {
    return currentHands.reduce((maxId, hand) => Math.max(maxId, hand.id), 0) + 1
  }

  const getActiveHand = () => hands[activeHand] ?? { cards: [], bet: 0, status: "playing" }

  const placeBet = async (betAmount) => {
    if (betAmount > money) return

    setMoney((prevMoney) => prevMoney - betAmount)
    setCurrentBet(betAmount)
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
      const remainingMoney = money - initialBet

      if (dealerShowsAce && maxInsurance > 0 && remainingMoney >= maxInsurance) {
        setGameState("insurancePrompt")
        return
      }

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
      cost = Math.floor(currentBet / 2)
      setInsuranceBet(cost)
      setMoney((prevMoney) => prevMoney - cost)
    }
    proceedAfterInsurance(hands[0]?.cards ?? [], dealerCards, cost)
  }

  const proceedAfterInsurance = (pCards, dCards, activeInsurance) => {
    const playerHasBJ = isBlackjack(pCards)
    const dealerHasBJ = isBlackjack(dCards)

    if (playerHasBJ || dealerHasBJ) {
      if (playerHasBJ && dealerHasBJ) {
        endGame("push", activeInsurance, dCards)
      } else if (playerHasBJ) {
        endGame("blackjack", activeInsurance, dCards)
      } else {
        endGame("dealer", activeInsurance, dCards)
      }
    } else {
      setGameState("playing")
    }
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

      const results = resolvedHands.map((hand) => determineWinner(hand.cards, currentDealerCards))
      endGame(results, insuranceBet, currentDealerCards)
    } catch (error) {
      console.error("Dealer play error:", error)
    }
  }

  const endGame = (winner, currentInsurance = insuranceBet, finalDealerCards = dealerCards) => {
    setGameState("gameOver")

    let insuranceWinnings = 0
    let insuranceMsg = ""
    if (currentInsurance > 0) {
      if (isBlackjack(finalDealerCards)) {
        insuranceWinnings = currentInsurance * 3
        insuranceMsg = ` (Insurance Pays +$${currentInsurance * 2})`
      } else {
        insuranceMsg = ` (Insurance Lost -$${currentInsurance})`
      }
    }

    if (Array.isArray(winner)) {
      let winnings = 0
      const msg = []
      const types = []

      hands.forEach((hand, index) => {
        const bet = hand.bet
        let handWinnings = 0
        let handMessage = ""
        let handType = ""

        switch (winner[index]) {
          case "player":
            handWinnings = bet * 2
            handMessage = `Hand ${index + 1} wins! +$${bet}`
            handType = "win"
            break
          case "blackjack":
            handWinnings = Math.floor(bet * 2.5)
            handMessage = `Hand ${index + 1} Blackjack! +$${Math.floor(bet * 1.5)}`
            handType = "blackjack"
            break
          case "dealer":
            handWinnings = 0
            handMessage = `Hand ${index + 1} loses! -$${bet}`
            handType = "lose"
            break
          case "push":
            handWinnings = bet
            handMessage = `Hand ${index + 1} push. Bet returned.`
            handType = "push"
            break
        }

        winnings += handWinnings
        msg.push(handMessage)
        types.push(handType)
      })

      setMoney((prevMoney) => prevMoney + winnings + insuranceWinnings)
      setMessage(msg.join(" | ") + insuranceMsg)
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

    setMoney((prevMoney) => prevMoney + winnings + insuranceWinnings)
    setMessage(messageText + insuranceMsg)
    setMessageType(msgType)
  }

  const newGame = () => {
    setHands([{ id: 1, cards: [], bet: 0, status: "playing" }])
    setActiveHand(0)
    setDealerCards([])
    setCurrentBet(0)
    setInsuranceBet(0)
    setGameState("betting")
    setMessage("")
    setMessageType("")
  }

  const hit = async () => {
    if (gameState !== "playing") return

    const currentHand = getActiveHand()
    if (!currentHand || currentHand.status !== "playing") return

    try {
      const newCards = await drawCards(deckId, 1)
      const updatedCards = [...currentHand.cards, ...newCards]
      const updatedHands = hands.map((hand, index) => {
        if (index !== activeHand) return hand
        return {
          ...hand,
          cards: updatedCards,
          status: isBust(updatedCards) ? "bust" : hand.status
        }
      })

      setHands(updatedHands)

      if (isBust(updatedCards)) {
        const nextPlayingHand = updatedHands.findIndex((hand, index) => index > activeHand && hand.status === "playing")
        if (nextPlayingHand >= 0) {
          setActiveHand(nextPlayingHand)
          return
        }

        setGameState("dealerTurn")
        dealerPlay(updatedHands)
        return
      }

      if (calculateHandValue(updatedCards) === 21) {
        stand(updatedHands)
      }
    } catch (error) {
      console.error("Failed to draw card:", error)
    }
  }

  const stand = (updatedHands = hands) => {
    if (gameState !== "playing") return

    const nextHands = updatedHands.map((hand, index) =>
      index === activeHand ? { ...hand, status: "stood" } : hand
    )

    setHands(nextHands)

    const nextPlayingHand = nextHands.findIndex((hand, index) => index > activeHand && hand.status === "playing")
    if (nextPlayingHand >= 0) {
      setActiveHand(nextPlayingHand)
      return
    }

    setGameState("dealerTurn")
    dealerPlay(nextHands)
  }

  const handleSplit = async () => {
    const currentHand = getActiveHand()
    if (!currentHand || currentHand.status !== "playing") return
    if (!canSplit(currentHand.cards) || money < currentHand.bet || hands.length >= 4) return

    try {
      const newCards = await drawCards(deckId, 2)
      const splitBet = currentHand.bet
      const firstHandCards = [currentHand.cards[0], newCards[0]]
      const secondHandCards = [currentHand.cards[1], newCards[1]]

      setMoney((prevMoney) => prevMoney - splitBet)

      const newHands = [...hands]
      newHands.splice(activeHand, 1, { ...currentHand, cards: firstHandCards, bet: splitBet, status: "playing" }, {
        id: createHandId(newHands),
        cards: secondHandCards,
        bet: splitBet,
        status: "playing"
      })

      setHands(newHands)
      setActiveHand(activeHand)
    } catch (error) {
      console.error("Failed to split hand:", error)
    }
  }

  const handleDoubleDown = async () => {
    const currentHand = getActiveHand()
    if (!currentHand || currentHand.status !== "playing") return
    if (currentHand.cards.length !== 2 || money < currentHand.bet) return

    try {
      const newCards = await drawCards(deckId, 1)
      const doubledBet = currentHand.bet * 2
      const updatedCards = [...currentHand.cards, ...newCards]
      const updatedHands = hands.map((hand, index) => {
        if (index !== activeHand) return hand
        return { ...hand, cards: updatedCards, bet: doubledBet, status: "stood" }
      })

      setMoney((prevMoney) => prevMoney - currentHand.bet)
      setHands(updatedHands)

      const nextPlayingHand = updatedHands.findIndex((hand, index) => index > activeHand && hand.status === "playing")
      if (nextPlayingHand >= 0) {
        setActiveHand(nextPlayingHand)
        return
      }

      setGameState("dealerTurn")
      dealerPlay(updatedHands)
    } catch (error) {
      console.error("Failed to double down:", error)
    }
  }

  const handleSurrender = () => {
    if (gameState !== "playing" || hands.length > 1) return
    const currentHand = getActiveHand()
    if (!currentHand || currentHand.cards.length !== 2) return

    const refundAmount = Math.floor(currentHand.bet / 2)
    setMoney((prevMoney) => prevMoney + refundAmount)
    setGameState("gameOver")
    setMessage(`Surrendered! Half bet returned (+$${refundAmount})`)
    setMessageType("push")
  }

  const activeHandState = getActiveHand()
  let canHit = false
  if (gameState === "playing" && activeHandState.status === "playing") {
    canHit = !isBust(activeHandState.cards) && calculateHandValue(activeHandState.cards) < 21
  }

  const showSplit = gameState === "playing" && activeHandState.status === "playing" && canSplit(activeHandState.cards) && money >= activeHandState.bet && hands.length < 4
  const showDoubleDown = gameState === "playing" && activeHandState.status === "playing" && activeHandState.cards.length === 2 && canDoubleDown(activeHandState.cards, money, activeHandState.bet)
  const canSurrender = gameState === "playing" && activeHandState.cards.length === 2 && hands.length === 1

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
                title={hands.length > 1 ? `Player ${index + 1}` : "Player"}
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
