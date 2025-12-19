import React from 'react';
import { render, screen } from '@testing-library/react';
import { HeartIcon } from '../components/icons/HeartIcon';

describe('HeartIcon', () => {
  it('renders filled heart when filled=true', () => {
    const { container } = render(<HeartIcon filled size={24} />);
    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute('fill', 'currentColor');
    expect(path).toHaveAttribute('stroke', 'none');
  });

  it('renders outlined heart when filled=false', () => {
    const { container } = render(<HeartIcon filled={false} size={24} />);
    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute('fill', 'none');
    expect(path).toHaveAttribute('stroke', 'currentColor');
  });
});
