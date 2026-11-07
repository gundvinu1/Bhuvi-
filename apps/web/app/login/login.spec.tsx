import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginPage from './page';

describe('LoginPage', () => {
  it('renders login form elements and links', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /BHUVI Login/i })).toBeDefined();
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/^Password$/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();
    expect(screen.getByText(/Don't have an account\?/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Register here/i })).toBeDefined();
  });
});
