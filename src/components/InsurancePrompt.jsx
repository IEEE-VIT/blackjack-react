"use client"

const InsurancePrompt = ({ insuranceAmount, onChoice }) => {
  return (
    <div className="insurance-prompt">
      <p className="insurance-text">Dealer shows an Ace. Buy insurance for ${insuranceAmount}?</p>
      <div className="insurance-buttons">
        <button onClick={() => onChoice(true)} className="control-btn insurance-yes-btn">
          Insure (${insuranceAmount})
        </button>
        <button onClick={() => onChoice(false)} className="control-btn insurance-no-btn">
          No Insurance
        </button>
      </div>
    </div>
  )
}

export default InsurancePrompt
