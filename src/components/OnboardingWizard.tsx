import React, { useState } from 'react';

// Step components (stub)
const WelcomeStep = ({ next }: { next: () => void }) => (
  <div>
    <h2>Welcome to Infinity Assistant</h2>
    <button onClick={next}>Start Onboarding</button>
  </div>
);
const AccountSetupStep = ({ next, prev }: { next: () => void; prev: () => void }) => (
  <div>
    <h2>Account Setup</h2>
    {/* Form fields here */}
    <button onClick={prev}>Back</button>
    <button onClick={next}>Next</button>
  </div>
);
const AgentSelectionStep = ({ next, prev }: { next: () => void; prev: () => void }) => (
  <div>
    <h2>Select Your Agent</h2>
    {/* Agent options here */}
    <button onClick={prev}>Back</button>
    <button onClick={next}>Next</button>
  </div>
);
const ContextIntroStep = ({ next, prev }: { next: () => void; prev: () => void }) => (
  <div>
    <h2>Context Management</h2>
    {/* Context info here */}
    <button onClick={prev}>Back</button>
    <button onClick={next}>Finish</button>
  </div>
);
const FinishStep = () => (
  <div>
    <h2>Onboarding Complete!</h2>
    <p>You’re ready to use Infinity Assistant.</p>
  </div>
);

const steps = [WelcomeStep, AccountSetupStep, AgentSelectionStep, ContextIntroStep, FinishStep];

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const next = async () => {
    setError('');
    setLoading(true);
    try {
      // Privacy validation: never send PII or proprietary data
      const progressPayload = { currentStep: step + 1, steps: steps.map((_, idx) => ({ completed: idx <= step + 1 })) };
      if (typeof progressPayload.currentStep !== 'number' || progressPayload.currentStep < 0) throw new Error('Invalid progress data');
      const res = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: progressPayload }),
      });
      if (!res.ok) throw new Error('Failed to sync onboarding progress');
      setStep((s) => Math.min(s + 1, steps.length - 1));
    } catch (e: any) {
      setError(e.message || 'Failed to advance step');
    } finally {
      setLoading(false);
    }
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const StepComponent = steps[step];
  return (
    <div aria-label="Onboarding Wizard" role="form" tabIndex={0}>
      <div aria-live="polite">Step {step + 1} of {steps.length}</div>
      {error && <div role="alert" style={{ color: 'red' }}>{error}</div>}
      {loading && <div aria-busy="true">Loading...</div>}
      <StepComponent next={next} prev={prev} />
    </div>
  );
}
