import { useState, useRef } from 'react';
import { Spinner } from './common';

/**
 * Resizes and center-crops an image file to a square data URL.
 * Produces high-quality, lightweight images (~20-40KB) perfect for avatars.
 */
export async function compressImage(file, maxSize = 360, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error al decodificar la imagen.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          const targetDim = Math.min(minDim, maxSize);
          canvas.width = targetDim;
          canvas.height = targetDim;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo inicializar el procesador de imágenes.'));
            return;
          }

          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetDim, targetDim);

          // Prefer image/jpeg for consistency and great compression
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function ImagePicker({
  value,
  onChange,
  fallback = '👤',
  shape = 'circle', // 'circle' | 'square'
  size = 96,
  label,
  hint,
}) {
  const [loading, setLoading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const borderRadius = shape === 'circle' ? '50%' : 'var(--radius-lg)';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    try {
      const compressed = await compressImage(file, 400, 0.85);
      onChange(compressed);
    } catch (err) {
      setError(err.message || 'Error al procesar la imagen');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetUrl = (e) => {
    e.preventDefault();
    if (!urlValue.trim()) return;
    onChange(urlValue.trim());
    setUrlValue('');
    setShowUrlInput(false);
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {label && <label className="form-label">{label}</label>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        {/* Preview Container / Trigger */}
        <div
          onClick={() => !loading && fileInputRef.current?.click()}
          style={{
            position: 'relative',
            width: size,
            height: size,
            borderRadius,
            overflow: 'hidden',
            cursor: 'pointer',
            border: value ? '2px solid var(--primary)' : '2px dashed var(--border)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all var(--transition-fast)',
            boxShadow: value ? '0 0 16px var(--primary-glow)' : 'none',
          }}
          title="Haz clic para subir una foto"
        >
          {loading ? (
            <Spinner size={24} />
          ) : value ? (
            <img
              src={value}
              alt="Avatar preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setError('No se pudo cargar la imagen')}
            />
          ) : (
            <div style={{ fontSize: size * 0.45, opacity: 0.8 }}>
              {fallback}
            </div>
          )}

          {/* Hover overlay badge */}
          {!loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity var(--transition-fast)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                gap: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
            >
              <span style={{ fontSize: '1.2rem' }}>📷</span>
              <span>Cambiar</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              style={{ fontSize: '0.82rem' }}
            >
              📁 Subir foto
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowUrlInput(!showUrlInput)}
              style={{ fontSize: '0.82rem' }}
            >
              🔗 Enlace
            </button>

            {value && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleRemove}
                style={{ color: 'var(--accent-red)', fontSize: '0.82rem' }}
              >
                ✕ Quitar
              </button>
            )}
          </div>

          {hint && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {hint}
            </span>
          )}
        </div>
      </div>

      {/* URL Input dropdown/subform */}
      {showUrlInput && (
        <div
          style={{
            marginTop: 'var(--space-2)',
            display: 'flex',
            gap: 'var(--space-2)',
            animation: 'fadeIn var(--transition-fast) ease',
          }}
        >
          <input
            className="form-input"
            placeholder="https://ejemplo.com/foto.jpg"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            style={{ fontSize: '0.85rem', padding: 'var(--space-2) var(--space-3)' }}
            autoFocus
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSetUrl}
            disabled={!urlValue.trim()}
          >
            Aplicar
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowUrlInput(false)}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <span style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginTop: 2 }}>
          {error}
        </span>
      )}
    </div>
  );
}
