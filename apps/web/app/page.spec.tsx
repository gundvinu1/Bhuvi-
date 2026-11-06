import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders BHUVI branding and foundation status', () => {
    render(<HomePage />);
    expect(screen.getByText('BHUVI')).toBeDefined();
    expect(
      screen.getByText('Brain for Human Virtual Intelligence'),
    ).toBeDefined();
    expect(
      screen.getByText('Your personal AI operating system.'),
    ).toBeDefined();
    expect(screen.getByText('Foundation initialized.')).toBeDefined();
  });
});

