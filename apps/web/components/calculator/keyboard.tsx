'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { CalculatorAction } from '@nextcalc/types';

interface KeyboardProps {
  onInput: (action: CalculatorAction) => void;
}

const KEYBOARD_LAYOUT = [
  ['sin', 'cos', 'tan', '(', ')'],
  ['7', '8', '9', '/', 'sqrt'],
  ['4', '5', '6', '*', '^'],
  ['1', '2', '3', '-', 'π'],
  ['0', '.', '=', '+', 'C'],
] as const;

export function Keyboard({ onInput }: KeyboardProps) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't interfere with normal typing in inputs
      if (event.target instanceof HTMLInputElement) return;

      const key = event.key;

      // Map keyboard keys to calculator inputs
      if (/^[0-9+\-*/().^]$/.test(key) || key === 'Enter' || key === 'Escape' || key === 'Backspace') {
        event.preventDefault();
        onInput({ type: 'KEY_PRESS', payload: key });
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onInput]);

  const handleButtonClick = (value: string) => {
    if (value === '=') {
      onInput({ type: 'EVALUATE' });
    } else if (value === 'C') {
      onInput({ type: 'CLEAR' });
    } else if (value === 'π') {
      onInput({ type: 'BUTTON_CLICK', payload: 'pi' });
    } else {
      onInput({ type: 'BUTTON_CLICK', payload: value });
    }
  };

  return (
    <div className="grid grid-cols-5 gap-2" role="grid" aria-label="Calculator keyboard">
      {KEYBOARD_LAYOUT.map((row, rowIdx) => (
        <div key={rowIdx} className="contents">
          {row.map((key) => (
            <Button
              key={key}
              onClick={() => handleButtonClick(key)}
              variant={
                key === '=' ? 'default' :
                ['+', '-', '*', '/', '^'].includes(key) ? 'secondary' :
                key === 'C' ? 'destructive' :
                'outline'
              }
              className="aspect-square text-lg font-semibold"
              aria-label={`Input ${key}`}
            >
              {key}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
