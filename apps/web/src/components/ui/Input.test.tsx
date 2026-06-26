import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('rendereli a label-t és összeköti az inputtal', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
  });

  it('rendereli a placeholdert', () => {
    render(<Input placeholder="te@pelda.hu" />);
    expect(screen.getByPlaceholderText('te@pelda.hu')).toBeInTheDocument();
  });

  it('érték-változáskor meghívja az onChange-et', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input label="Név" onChange={onChange} />);
    await user.type(screen.getByLabelText('Név'), 'abc');
    expect(onChange).toHaveBeenCalled();
    expect((screen.getByLabelText('Név') as HTMLInputElement).value).toBe(
      'abc',
    );
  });

  it('hiba-állapotban megjeleníti az üzenetet alert szerepkörrel', () => {
    render(<Input label="Jelszó" error="Kötelező mező" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Kötelező mező');
  });

  it('hiba-állapotban aria-invalid és aria-describedby kerül az inputra', () => {
    render(<Input label="Jelszó" error="Kötelező mező" />);
    const input = screen.getByLabelText('Jelszó');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    expect(input).toHaveClass('border-red-500');
  });

  it('hiba nélkül nincs alert és nincs aria-invalid', () => {
    render(<Input label="Jelszó" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Jelszó')).not.toHaveAttribute(
      'aria-invalid',
    );
  });
});
