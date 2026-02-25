import React, { useState, useEffect, useRef } from 'react';

interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  step?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}

function formatWithThousands(val: string): string {
  if (!val) return '';
  const parts = val.split('.');
  const intPart = parts[0].replace(/\s/g, '');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.length > 1 ? `${formatted}.${parts[1]}` : formatted;
}

function stripFormatting(val: string): string {
  return val.replace(/\s/g, '');
}

const MoneyInput = ({ value, onChange, placeholder, className = '', step, min, max, disabled }: MoneyInputProps) => {
  const [display, setDisplay] = useState(() => formatWithThousands(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sync display when value changes externally
    if (stripFormatting(display) !== value) {
      setDisplay(formatWithThousands(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, dots, and spaces only
    const cleaned = raw.replace(/[^\d.\s]/g, '');
    const stripped = stripFormatting(cleaned);
    
    // Validate it's a valid number pattern
    if (stripped && !/^\d*\.?\d*$/.test(stripped)) return;
    
    setDisplay(formatWithThousands(stripped));
    onChange(stripped);
  };

  const handleBlur = () => {
    // Normalize on blur
    const stripped = stripFormatting(display);
    if (stripped && !isNaN(Number(stripped))) {
      const normalized = parseFloat(Number(stripped).toFixed(2)).toString();
      setDisplay(formatWithThousands(normalized));
      onChange(normalized);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
};

export default MoneyInput;
