import { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...rest }: Props) {
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-dark'
      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${styles} ${className}`}
      {...rest}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
