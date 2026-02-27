'use client';
import { useState, useEffect } from 'react';
import { useCanvas } from '@/context/CanvasContext';
import IconButton from '../ui/IconButton';

interface LayoutPanelProps {
  nodeId: string;
  styles: Record<string, string>;
}

type DisplayMode = 'block' | 'flex' | 'grid' | 'none';
type FlexDirection = 'row' | 'column';
type FlexWrap = 'nowrap' | 'wrap';
type AlignItems = 'flex-start' | 'center' | 'flex-end' | 'stretch';
type JustifyContent = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: 'block', label: 'Block' },
  { value: 'flex', label: 'Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'none', label: 'None' },
];

const ALIGN_ITEMS_OPTIONS: { value: AlignItems; label: string; icon: string }[] = [
  { value: 'flex-start', label: 'Start', icon: '⬆' },
  { value: 'center', label: 'Center', icon: '↕' },
  { value: 'flex-end', label: 'End', icon: '⬇' },
  { value: 'stretch', label: 'Stretch', icon: '⇕' },
];

const JUSTIFY_CONTENT_OPTIONS: { value: JustifyContent; label: string; icon: string }[] = [
  { value: 'flex-start', label: 'Start', icon: '|←' },
  { value: 'center', label: 'Center', icon: '↔' },
  { value: 'flex-end', label: 'End', icon: '→|' },
  { value: 'space-between', label: 'Between', icon: '|↔|' },
  { value: 'space-around', label: 'Around', icon: '⤚↔⤙' },
];

export default function LayoutPanel({ nodeId, styles }: LayoutPanelProps) {
  const { updateStyles } = useCanvas();
  const update = (patch: Record<string, string>) => updateStyles(nodeId, patch);

  const display = (styles.display ?? 'block') as DisplayMode;
  const flexDirection = (styles.flexDirection ?? 'row') as FlexDirection;
  const flexWrap = (styles.flexWrap ?? 'nowrap') as FlexWrap;
  const alignItems = (styles.alignItems ?? 'flex-start') as AlignItems;
  const justifyContent = (styles.justifyContent ?? 'flex-start') as JustifyContent;

  // Fix 3: Controlled inputs with local state, synced via useEffect on external STDB updates
  const [gapValue, setGapValue] = useState(styles.gap ?? '');
  const [columnGapValue, setColumnGapValue] = useState(styles.columnGap ?? '');
  const [rowGapValue, setRowGapValue] = useState(styles.rowGap ?? '');
  const [gridTemplateRowsValue, setGridTemplateRowsValue] = useState(styles.gridTemplateRows ?? '');

  useEffect(() => { setGapValue(styles.gap ?? ''); }, [styles.gap]);
  useEffect(() => { setColumnGapValue(styles.columnGap ?? ''); }, [styles.columnGap]);
  useEffect(() => { setRowGapValue(styles.rowGap ?? ''); }, [styles.rowGap]);
  useEffect(() => { setGridTemplateRowsValue(styles.gridTemplateRows ?? ''); }, [styles.gridTemplateRows]);

  // Parse gridTemplateColumns: "repeat(N, 1fr)" → N
  const gridColumnsMatch = (styles.gridTemplateColumns ?? '').match(/^repeat\((\d+),\s*1fr\)$/);
  const gridColumns = gridColumnsMatch ? parseInt(gridColumnsMatch[1], 10) : 2;

  const [gridColumnsValue, setGridColumnsValue] = useState(String(gridColumns));
  useEffect(() => { setGridColumnsValue(String(gridColumns)); }, [gridColumns]);

  const handleDisplayChange = (value: DisplayMode) => {
    update({ display: value });
  };

  return (
    <div className="layout-panel">
      <h3 className="layout-section-title">Layout</h3>

      {/* Display mode toggle */}
      <div className="layout-section">
        <span className="layout-label">Display</span>
        <div className="icon-btn-group">
          {DISPLAY_MODES.map(({ value, label }) => (
            <IconButton
              key={value}
              label={label}
              active={display === value}
              onClick={() => handleDisplayChange(value)}
            >
              {label}
            </IconButton>
          ))}
        </div>
      </div>

      {/* Flex controls */}
      {display === 'flex' && (
        <>
          <div className="layout-section">
            <span className="layout-label">Direction</span>
            <div className="icon-btn-group">
              <IconButton
                label="Row"
                active={flexDirection === 'row'}
                onClick={() => update({ flexDirection: 'row' })}
              >
                → Row
              </IconButton>
              <IconButton
                label="Column"
                active={flexDirection === 'column'}
                onClick={() => update({ flexDirection: 'column' })}
              >
                ↓ Col
              </IconButton>
            </div>
          </div>

          <div className="layout-section">
            <span className="layout-label">Wrap</span>
            <div className="icon-btn-group">
              <IconButton
                label="No Wrap"
                active={flexWrap === 'nowrap'}
                onClick={() => update({ flexWrap: 'nowrap' })}
              >
                No Wrap
              </IconButton>
              <IconButton
                label="Wrap"
                active={flexWrap === 'wrap'}
                onClick={() => update({ flexWrap: 'wrap' })}
              >
                Wrap
              </IconButton>
            </div>
          </div>

          <div className="layout-section">
            <span className="layout-label">Align</span>
            <div className="icon-btn-group">
              {ALIGN_ITEMS_OPTIONS.map(({ value, label, icon }) => (
                <IconButton
                  key={value}
                  label={label}
                  active={alignItems === value}
                  onClick={() => update({ alignItems: value })}
                >
                  {icon}
                </IconButton>
              ))}
            </div>
          </div>

          <div className="layout-section">
            <span className="layout-label">Justify</span>
            <div className="icon-btn-group">
              {JUSTIFY_CONTENT_OPTIONS.map(({ value, label, icon }) => (
                <IconButton
                  key={value}
                  label={label}
                  active={justifyContent === value}
                  onClick={() => update({ justifyContent: value })}
                >
                  {icon}
                </IconButton>
              ))}
            </div>
          </div>

          <div className="layout-section">
            <span className="layout-label">Gap</span>
            <input
              className="style-input layout-input-sm"
              value={gapValue}
              placeholder="e.g. 8px"
              onChange={e => setGapValue(e.target.value)}
              onBlur={() => update({ gap: gapValue })}
            />
          </div>
        </>
      )}

      {/* Grid controls */}
      {display === 'grid' && (
        <>
          <div className="layout-section">
            <span className="layout-label">Columns</span>
            <input
              className="style-input layout-input-sm"
              type="number"
              min={1}
              value={gridColumnsValue}
              onChange={e => setGridColumnsValue(e.target.value)}
              onBlur={() => {
                const n = Math.max(1, parseInt(gridColumnsValue, 10) || 1);
                update({ gridTemplateColumns: `repeat(${n}, 1fr)` });
              }}
            />
          </div>

          <div className="layout-section">
            <span className="layout-label">Rows</span>
            <input
              className="style-input layout-input-sm"
              value={gridTemplateRowsValue}
              placeholder="auto"
              onChange={e => setGridTemplateRowsValue(e.target.value)}
              onBlur={() => update({ gridTemplateRows: gridTemplateRowsValue })}
            />
          </div>

          <div className="layout-section">
            <span className="layout-label">Col Gap</span>
            <input
              className="style-input layout-input-sm"
              value={columnGapValue}
              placeholder="e.g. 8px"
              onChange={e => setColumnGapValue(e.target.value)}
              onBlur={() => update({ columnGap: columnGapValue })}
            />
          </div>

          <div className="layout-section">
            <span className="layout-label">Row Gap</span>
            <input
              className="style-input layout-input-sm"
              value={rowGapValue}
              placeholder="e.g. 8px"
              onChange={e => setRowGapValue(e.target.value)}
              onBlur={() => update({ rowGap: rowGapValue })}
            />
          </div>

          <div className="layout-section">
            <span className="layout-label">Align</span>
            <div className="icon-btn-group">
              {ALIGN_ITEMS_OPTIONS.map(({ value, label, icon }) => (
                <IconButton
                  key={value}
                  label={label}
                  active={alignItems === value}
                  onClick={() => update({ alignItems: value })}
                >
                  {icon}
                </IconButton>
              ))}
            </div>
          </div>

          <div className="layout-section">
            <span className="layout-label">Justify</span>
            <div className="icon-btn-group">
              {JUSTIFY_CONTENT_OPTIONS.map(({ value, label, icon }) => (
                <IconButton
                  key={value}
                  label={label}
                  active={justifyContent === value}
                  onClick={() => update({ justifyContent: value })}
                >
                  {icon}
                </IconButton>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
