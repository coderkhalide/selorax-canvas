import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, fontWeight: 500, cursor: 'pointer', border: 'none',
    transition: 'opacity 0.15s',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: '#7C3AED', color: '#fff' },
    secondary: { background: '#f3f4f6', color: '#374151' },
    ghost:     { background: 'transparent', color: '#374151' },
  };

  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 14 },
    lg: { padding: '12px 24px', fontSize: 16 },
  };

  return (
    <button style={{ ...base, ...variants[variant], ...sizes[size], ...style }} {...props}>
      {children}
    </button>
  );
}
