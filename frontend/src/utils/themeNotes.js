export const NOTE_COLOR_PRESETS = [
  { id: 'default', dark: 'var(--bg-surface)', light: 'var(--bg-surface)', label: 'Normal' },
  { id: 'green', dark: '#1f3320', light: '#eaf8f0', borderLight: '#a7f3d0', borderDark: 'rgba(67, 233, 123, 0.3)', label: 'Verde' },
  { id: 'red', dark: '#2d1515', light: '#fdf2f4', borderLight: '#fecdd3', borderDark: 'rgba(255, 107, 107, 0.3)', label: 'Rojo' },
  { id: 'blue', dark: '#0f1d3d', light: '#f0f6ff', borderLight: '#bfdbfe', borderDark: 'rgba(77, 171, 247, 0.3)', label: 'Azul' },
  { id: 'yellow', dark: '#2d2800', light: '#fef9ee', borderLight: '#fde68a', borderDark: 'rgba(255, 169, 77, 0.3)', label: 'Amarillo' },
  { id: 'purple', dark: '#2a1040', light: '#f6f3fe', borderLight: '#ddd6fe', borderDark: 'rgba(108, 99, 255, 0.3)', label: 'Morado' },
  { id: 'cyan', dark: '#0d2b2b', light: '#eefbfc', borderLight: '#a5f3fc', borderDark: 'rgba(20, 184, 166, 0.3)', label: 'Turquesa' },
];

export function getNoteCardStyle(color, isLight) {
  if (!color || color === '#1e1e2e' || color === 'default') {
    return {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
    };
  }

  const preset = NOTE_COLOR_PRESETS.find(
    p => p.id === color || p.dark === color || p.light === color
  );

  if (preset) {
    return {
      background: isLight ? preset.light : preset.dark,
      border: `1px solid ${isLight ? preset.borderLight : preset.borderDark}`,
    };
  }

  return {
    background: color,
    border: '1px solid var(--border)',
  };
}
