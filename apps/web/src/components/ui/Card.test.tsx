import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription } from './Card';

describe('Card', () => {
  it('rendereli a children-t', () => {
    render(<Card>Tartalom</Card>);
    expect(screen.getByText('Tartalom')).toBeInTheDocument();
  });

  it('továbbadja az egyedi className-t', () => {
    render(<Card className="egyedi-class">Tartalom</Card>);
    expect(screen.getByText('Tartalom')).toHaveClass('egyedi-class');
  });

  it('hoverable esetén hover class-t kap', () => {
    render(<Card hoverable>Tartalom</Card>);
    expect(screen.getByText('Tartalom')).toHaveClass('hover:shadow-card-hover');
  });

  it('a CardTitle h3 fejlécként renderel', () => {
    render(<CardTitle>Cím</CardTitle>);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Cím' }),
    ).toBeInTheDocument();
  });

  it('a CardHeader és CardDescription rendereli a children-t', () => {
    render(
      <CardHeader>
        <CardDescription>Leírás</CardDescription>
      </CardHeader>,
    );
    expect(screen.getByText('Leírás')).toBeInTheDocument();
  });
});
