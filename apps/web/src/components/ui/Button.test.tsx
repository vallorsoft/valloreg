import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('rendereli a children-t', () => {
    render(<Button>Mentés</Button>);
    expect(
      screen.getByRole('button', { name: 'Mentés' }),
    ).toBeInTheDocument();
  });

  it('alapból primary variantot és md méretet ad', () => {
    render(<Button>Alap</Button>);
    const btn = screen.getByRole('button', { name: 'Alap' });
    // primary variant: bg-primary-600 ; md méret: h-11
    expect(btn).toHaveClass('bg-primary-600');
    expect(btn).toHaveClass('h-11');
  });

  it('a variant prop a megfelelő class-t adja (outline)', () => {
    render(<Button variant="outline">Körvonal</Button>);
    const btn = screen.getByRole('button', { name: 'Körvonal' });
    expect(btn).toHaveClass('border');
    expect(btn).toHaveClass('bg-white');
  });

  it('a size prop a megfelelő class-t adja (lg)', () => {
    render(<Button size="lg">Nagy</Button>);
    const btn = screen.getByRole('button', { name: 'Nagy' });
    expect(btn).toHaveClass('h-12');
  });

  it('fullWidth esetén w-full class kerül rá', () => {
    render(<Button fullWidth>Teljes</Button>);
    expect(screen.getByRole('button', { name: 'Teljes' })).toHaveClass(
      'w-full',
    );
  });

  it('kattintáskor meghívja az onClick-et', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Kattints</Button>);
    await user.click(screen.getByRole('button', { name: 'Kattints' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled állapotban nem hívja meg az onClick-et', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Tiltott
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Tiltott' });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('alapból type="button"-ként renderel', () => {
    render(<Button>Típus</Button>);
    expect(screen.getByRole('button', { name: 'Típus' })).toHaveAttribute(
      'type',
      'button',
    );
  });
});
