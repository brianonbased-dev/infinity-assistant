import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AgentModal from '../AgentModal';

describe('AgentModal', () => {
  it('renders modal and validates input', () => {
    render(<AgentModal open={true} onClose={() => {}} />);
    expect(screen.getByText(/Add\/Edit Agent/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Save/i));
    expect(screen.getByText(/Agent name required/i)).toBeInTheDocument();
  });
});
