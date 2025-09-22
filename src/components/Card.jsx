import { useState, useEffect } from "react"

const Card = ({ card, hidden = false }) => {
  const [flip, setFlip] = useState(false)

  useEffect(() => {
    if (!hidden) {
      const timer = setTimeout(() => setFlip(true), 100) // flip card in after mount
      return () => clearTimeout(timer)
    } else {
      setFlip(false)
    }
  }, [hidden])

  if (hidden) {
    return (
      <div className="card card-back">
        <div className="card-pattern"></div>
      </div>
    )
  }

  const isRed = card.suit === "HEARTS" || card.suit === "DIAMONDS"
  const suitSymbol = {
    HEARTS: "♥",
    DIAMONDS: "♦",
    CLUBS: "♣",
    SPADES: "♠",
  }

  return (
    <div className={`card ${isRed ? "red" : "black"} ${flip ? "flip-in" : ""}`}>
      <div className="card-corner top-left">
        <div className="card-value">{card.value}</div>
        <div className="card-suit">{suitSymbol[card.suit]}</div>
      </div>
      <div className="card-center">
        <div className="card-suit-large">{suitSymbol[card.suit]}</div>
      </div>
      <div className="card-corner bottom-right">
        <div className="card-value">{card.value}</div>
        <div className="card-suit">{suitSymbol[card.suit]}</div>
      </div>
    </div>
  )
}

export default Card
