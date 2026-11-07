import React from 'react';
import { render, screen } from '@testing-library/react';
import RegisterPage from './page';

describe('RegisterPage', () => {
  it('renders registration form elements and links', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('heading', { name: /BHUVI Registration/i })).toBeDefined();
    expect(screen.getByLabelText(/Full Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/^Password$/i)).toBeDefined();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeDefined();
    expect(screen.getByText(/Already have an account\?/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Sign in here/i })).toBeDefined();
  });
});

