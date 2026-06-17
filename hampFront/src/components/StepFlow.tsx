type StepFlowProps = {
  steps: string[]
}

export function StepFlow({ steps }: StepFlowProps) {
  return (
    <div className="stepFlow">
      {steps.map((step) => (
        <span key={step}>{step}</span>
      ))}
    </div>
  )
}
