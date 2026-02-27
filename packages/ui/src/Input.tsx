import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '8px 12px',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14,
    outline: 'none', transition: 'border-color 0.15s',
    ...style,
  };

  if (!label) return <input style={inputStyle} {...props} />;

  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#374151', fontWeight: 500 }}>
        {label}
      </span>
      <input style={inputStyle} {...props} />
    </label>
  );
}
