'use client';
import { useState, useEffect, useRef } from 'react';
import { toPng, toJpeg } from 'html-to-image';

type Format = 'png' | 'jpg';
type Scale = 1 | 2;

export default function ExportButton() {
  const [open, setOpen]       = useState(false);
  const [format, setFormat]   = useState<Format>('png');
  const [scale, setScale]     = useState<Scale>(1);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleMousedown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, [open]);

  async function capture(): Promise<string> {
    const frame = document.querySelector('.canvas-frame') as HTMLElement;
    if (!frame) throw new Error('Canvas frame not found');
    if (format === 'png') {
      return toPng(frame, { pixelRatio: scale });
    }
    return toJpeg(frame, { pixelRatio: scale, quality: 0.95 });
  }

  async function handleDownload() {
    setLoading(true);
    try {
      const dataUrl = await capture();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `canvas-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setOpen(false);
    } catch (err: unknown) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    setLoading(true);
    try {
      const dataUrl = await capture();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setOpen(false);
    } catch (err: unknown) {
      alert(`Copy failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(prev => !prev)}
        disabled={loading}
        style={{ minWidth: 80 }}
      >
        {loading ? '...' : 'Export \u2193'}
      </button>

      {open && (
        <div className="export-dropdown">
          {/* Format row */}
          <div className="export-row">
            <span className="export-label">Format</span>
            <div className="icon-btn-group">
              <button
                className={`icon-btn${format === 'png' ? ' active' : ''}`}
                onClick={() => setFormat('png')}
              >
                PNG
              </button>
              <button
                className={`icon-btn${format === 'jpg' ? ' active' : ''}`}
                onClick={() => setFormat('jpg')}
              >
                JPG
              </button>
            </div>
          </div>

          {/* Scale row */}
          <div className="export-row">
            <span className="export-label">Scale</span>
            <div className="icon-btn-group">
              <button
                className={`icon-btn${scale === 1 ? ' active' : ''}`}
                onClick={() => setScale(1)}
              >
                1x
              </button>
              <button
                className={`icon-btn${scale === 2 ? ' active' : ''}`}
                onClick={() => setScale(2)}
              >
                2x
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="export-actions">
            <button
              className="btn btn-primary"
              style={{ flex: 1, fontSize: 12 }}
              onClick={handleDownload}
              disabled={loading}
            >
              Download
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: 12 }}
              onClick={handleCopy}
              disabled={loading}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
