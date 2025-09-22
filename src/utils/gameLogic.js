export const getCardValue = (card) => {
  if (["JACK", "QUEEN", "KING"].includes(card.value)) {
    return 10
  }
  if (card.value === "ACE") {
    return 11 // We'll handle ace logic separately
  }
  return Number.parseInt(card.value)
}

export const calculateHandValue = (cards) => {
  let value = 0
  let aces = 0

  cards.forEach((card) => {
    if (card.value === "ACE") {
      aces++
      value += 11
    } else {
      value += getCardValue(card)
    }
  })

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

export const isBlackjack = (cards) => {
  return cards.length === 2 && calculateHandValue(cards) === 21
}

export const isBust = (cards) => {
  return calculateHandValue(cards) > 21
}

export const shouldDealerHit = (cards) => {
  return calculateHandValue(cards) < 17
}

export const determineWinner = (playerCards, dealerCards) => {
  const playerValue = calculateHandValue(playerCards)
  const dealerValue = calculateHandValue(dealerCards)
  const playerBlackjack = isBlackjack(playerCards)
  const dealerBlackjack = isBlackjack(dealerCards)

  if (isBust(playerCards)) return "dealer"
  if (isBust(dealerCards)) return "player"
  if (playerBlackjack && !dealerBlackjack) return "blackjack"
  if (dealerBlackjack && !playerBlackjack) return "dealer"
  if (playerValue > dealerValue) return "player"
  if (dealerValue > playerValue) return "dealer"
  return "push"
}


// Can split if two cards of same value
export const canSplit = (cards) => {
  return cards.length === 2 && getCardValue(cards[0]) === getCardValue(cards[1]);
}

// Can double down if two cards and enough money
export const canDoubleDown = (cards, money, bet) => {
  return cards.length === 2 && money >= bet;
}
