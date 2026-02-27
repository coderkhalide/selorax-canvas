'use client';
interface IconButtonProps {
  label: string; active?: boolean;
  onClick?: () => void; children: React.ReactNode;
}
export default function IconButton({ label, active, onClick, children }: IconButtonProps) {
  return (
    <button
      title={label}
      className={`icon-btn${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
