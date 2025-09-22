import Card from "./Card"
import { calculateHandValue } from "../utils/gameLogic"

const Hand = ({
  cards,
  title,
  hideFirstCard = false,
  showValue = true,
  isActiveHand = false,
  handIndex = 0,
}) => {
  const visibleCards = hideFirstCard ? cards.slice(1) : cards
  const handValue = hideFirstCard
    ? cards.length > 1
      ? calculateHandValue(visibleCards)
      : "?"
    : calculateHandValue(cards)

  // Example: Highlight active hand in split situation
  const activeClass = isActiveHand ? "active-hand" : ""

  return (
    <div className={`hand ${activeClass}`}>
      <div className="hand-title">
        {title} {showValue && `(${handValue})`}
      </div>
      <div className="cards-container">
        {cards.map((card, index) => (
          <Card
            key={`${card.suit}-${card.value}-${index}-${handIndex}`}
            card={card}
            hidden={hideFirstCard && index === 0}
          />
        ))}
      </div>
    </div>
  )
}

export default Hand
