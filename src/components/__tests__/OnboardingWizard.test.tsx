import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingWizard from '../OnboardingWizard';

describe('OnboardingWizard', () => {
  it('renders onboarding steps and advances', async () => {
    render(<OnboardingWizard />);
    expect(screen.getByText(/Welcome to Infinity Assistant/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Start Onboarding/i));
    expect(screen.getByText(/Account Setup/i)).toBeInTheDocument();
  });
});
