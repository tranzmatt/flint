// Single source of truth for the Flint logo.
// Uses /flint-logo.png — replace that file to change the logo everywhere.
// No SVG fallback. If PNG missing, shows a styled "F" letter.

export function FlintLogo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/flint-logo.png"
      alt="Flint"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
      draggable={false}
    />
  );
}

export function FlintLogoLarge({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/flint-logo.png"
      alt="Flint"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
      draggable={false}
    />
  );
}

export default FlintLogo;
