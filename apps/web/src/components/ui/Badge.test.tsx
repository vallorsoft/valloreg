import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('rendereli a children-t', () => {
    render(<Badge>Aktív</Badge>);
    expect(screen.getByText('Aktív')).toBeInTheDocument();
  });

  it('alapból neutral tone class-t kap', () => {
    render(<Badge>Semleges</Badge>);
    expect(screen.getByText('Semleges')).toHaveClass('bg-anthracite-100');
  });

  it('a tone prop a megfelelő class-t adja (success)', () => {
    render(<Badge tone="success">Kész</Badge>);
    expect(screen.getByText('Kész')).toHaveClass('bg-emerald-100');
  });

  it('a tone prop a megfelelő class-t adja (danger)', () => {
    render(<Badge tone="danger">Hiba</Badge>);
    expect(screen.getByText('Hiba')).toHaveClass('bg-red-100');
  });

  it('továbbadja az egyedi className-t', () => {
    render(<Badge className="egyedi-class">Címke</Badge>);
    expect(screen.getByText('Címke')).toHaveClass('egyedi-class');
  });
});
