import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtocolTimeline from '../ProtocolTimeline';

describe('ProtocolTimeline', () => {
  it('renders protocol phases', () => {
    render(<ProtocolTimeline currentPhase={2} />);
    expect(screen.getByText(/Protocol Cycle Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/EXECUTE/i)).toBeInTheDocument();
  });
});
