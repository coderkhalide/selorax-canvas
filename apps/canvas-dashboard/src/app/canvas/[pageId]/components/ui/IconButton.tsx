'use client';
import React from 'react';

interface IconButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export default function IconButton({ label, active = false, onClick, children, disabled = false }: IconButtonProps) {
  return (
    <button
      className={`icon-btn${active ? ' active' : ''}`}
      title={label}
      onClick={onClick}
      disabled={disabled}
      type="button"
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
