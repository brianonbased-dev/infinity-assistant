import React from 'react';
import { render, screen } from '@testing-library/react';
import ContextViewer from '../ContextViewer';

describe('ContextViewer', () => {
  it('renders context viewer', () => {
    render(<ContextViewer />);
    expect(screen.getByText(/Context Viewer/i)).toBeInTheDocument();
  });
});
