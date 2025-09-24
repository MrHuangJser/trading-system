import { render } from '@testing-library/react';

import App from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
  });

  it('should render the strategy overview heading', async () => {
    const { findByText } = render(<App />);
    expect(await findByText(/strategy overview/i)).toBeInTheDocument();
  });
});
