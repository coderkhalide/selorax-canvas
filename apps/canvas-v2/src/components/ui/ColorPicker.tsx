import React, { useRef, useEffect, useState, useMemo } from "react";
import { RgbaColorPicker, RgbaColor } from "react-colorful";
import { Colord, colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
import {
  Copy,
  Plus,
  ChevronRight,
  Check,
  Circle,
  CircleDot,
  Minus,
  PieChart,
  Pipette,
  Search,
  Sun,
  Moon,
  ChevronLeft,
  X,
  Pencil,
  ChevronDown,
} from "lucide-react";

extend([namesPlugin]);

interface ColorPickerProps {
  color: string; // Can be hex, rgba, or gradient string
  onChange: (color: string) => void;
  onClose: () => void;
  presetColors?: string[];
  onSaveStyle?: (name: string, color: string) => void;
}

type Mode = "solid" | "linear" | "radial" | "conic";
type View = "default" | "new_style";
type Format = "hex" | "rgb" | "hsl";
type SavedStyle = { name: string; value: string };

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  onClose,
  presetColors = [],
  onSaveStyle,
}) => {
  const popover = useRef<HTMLDivElement>(null);
  const STORAGE_KEY = "selora.colorStyles";

  // Parse initial state
  const initializeState = (
    colorStr: string,
  ): { mode: Mode; activeColor: string } => {
    const s = colorStr.toLowerCase();
    if (s.includes("linear-gradient"))
      return { mode: "linear", activeColor: extractColor(s) };
    if (s.includes("radial-gradient"))
      return { mode: "radial", activeColor: extractColor(s) };
    if (s.includes("conic-gradient"))
      return { mode: "conic", activeColor: extractColor(s) };
    return { mode: "solid", activeColor: colorStr };
  };

  // Helper to grab the first color from a gradient string roughly
  const extractColor = (grad: string): string => {
    // Very naive regex to find first rgba/hex/hsl
    const match = grad.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/i);
    return match ? match[0] : "#ffffff";
  };

  const [view, setView] = useState<View>("default");
  const [mode, setMode] = useState<Mode>(() => initializeState(color).mode);
  const [localColor, setLocalColor] = useState<string>(
    () => initializeState(color).activeColor,
  );
  const [format, setFormat] = useState<Format>("hex");
  const [newStyleName, setNewStyleName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLightMode, setIsLightMode] = useState(true);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Sync if external color changes significantly (e.g. undo/redo)
  useEffect(() => {
    const currentConstruct = constructValue(mode, localColor);
    if (currentConstruct !== color) {
      if (
        (mode === "solid" && !color.includes("gradient")) ||
        (mode !== "solid" && color.includes(mode))
      ) {
        if (!color.includes("gradient")) {
          setLocalColor(color);
          setMode("solid");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedStyle[];
        if (Array.isArray(parsed)) setSavedStyles(parsed);
      }
    } catch {}
  }, []);

  const persistStyles = (arr: SavedStyle[]) => {
    setSavedStyles(arr);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {}
  };

  const constructValue = (m: Mode, c: string): string => {
    if (m === "solid") return c;
    if (m === "linear")
      return `linear-gradient(180deg, ${c} 0%, rgba(255,255,255,0) 100%)`;
    if (m === "radial")
      return `radial-gradient(circle, ${c} 0%, rgba(255,255,255,0) 100%)`;
    if (m === "conic")
      return `conic-gradient(from 180deg at 50% 50%, ${c} 0deg, rgba(255,255,255,0) 360deg)`;
    return c;
  };

  const handleColorChange = (newColorObj: RgbaColor) => {
    const newColorString = colord(newColorObj).toHex();
    setLocalColor(newColorString);
    onChange(constructValue(mode, newColorString));
  };

  const handleModeChange = (m: Mode) => {
    setMode(m);
    onChange(constructValue(m, localColor));
  };

  const handleEyedropper = async () => {
    if (!(window as any).EyeDropper) return;
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      const hex = colord(result.sRGBHex).toHex();
      setLocalColor(hex);
      onChange(constructValue(mode, hex));
    } catch (e) {
      console.log("Eyedropper cancelled");
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popover.current && !popover.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [onClose]);

  const recentColors = useMemo(() => {
    return ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#06b6d4"];
  }, []);

  const rgba = colord(localColor).toRgb();
  const hsla = colord(localColor).toHsl();

  // Inputs rendering helper
  const renderInputs = () => {
    if (format === "hex") {
      return (
        <div className="flex-1">
          <input
            value={localColor.toUpperCase()}
            onChange={(e) => {
              const val = e.target.value;
              if (colord(val).isValid()) {
                const hex = colord(val).toHex();
                setLocalColor(hex);
                onChange(constructValue(mode, hex));
              }
            }}
            className="w-full h-8 text-xs bg-gray-50 border border-gray-200 rounded px-2 outline-none focus:border-blue-500 font-mono text-gray-700 uppercase"
          />
        </div>
      );
    }

    if (format === "rgb") {
      return (
        <div className="flex gap-1 flex-1">
          {[
            { l: "R", v: rgba.r, k: "r", max: 255 },
            { l: "G", v: rgba.g, k: "g", max: 255 },
            { l: "B", v: rgba.b, k: "b", max: 255 },
            { l: "A", v: Math.round(rgba.a * 100), k: "a", max: 100 },
          ].map(({ l, v, k, max }) => (
            <div key={k} className="flex-1 min-w-0">
              <input
                type="number"
                value={v}
                min={0}
                max={max}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const newRgba = { ...rgba, [k]: k === "a" ? val / 100 : val };
                  const hex = colord(newRgba).toHex();
                  setLocalColor(hex);
                  onChange(constructValue(mode, hex));
                }}
                className="w-full h-8 text-xs bg-gray-50 border border-gray-200 rounded px-1 text-center outline-none focus:border-blue-500 font-mono text-gray-700"
              />
            </div>
          ))}
        </div>
      );
    }

    if (format === "hsl") {
      return (
        <div className="flex gap-1 flex-1">
          {[
            { l: "H", v: Math.round(hsla.h), k: "h", max: 360 },
            { l: "S", v: Math.round(hsla.s), k: "s", max: 100 },
            { l: "L", v: Math.round(hsla.l), k: "l", max: 100 },
            { l: "A", v: Math.round(hsla.a * 100), k: "a", max: 100 },
          ].map(({ l, v, k, max }) => (
            <div key={k} className="flex-1 min-w-0">
              <input
                type="number"
                value={v}
                min={0}
                max={max}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const newHsl = { ...hsla, [k]: k === "a" ? val / 100 : val };
                  const hex = colord(newHsl).toHex();
                  setLocalColor(hex);
                  onChange(constructValue(mode, hex));
                }}
                className="w-full h-8 text-xs bg-gray-50 border border-gray-200 rounded px-1 text-center outline-none focus:border-blue-500 font-mono text-gray-700"
              />
            </div>
          ))}
        </div>
      );
    }
  };

  // Gradient editor removed per request

  const renderPickerBody = () => (
    <>
      <div className="custom-picker mb-3">
        <RgbaColorPicker color={rgba} onChange={handleColorChange} />
      </div>

      <div className="flex gap-2 mb-3">
        {/* Format Dropdown */}
        <div className="relative min-w-[70px]">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
            className="w-full h-8 text-xs bg-gray-100 border border-gray-200 rounded px-2 outline-none focus:border-blue-500 appearance-none cursor-pointer font-medium text-gray-600"
          >
            <option value="hex">HEX</option>
            <option value="rgb">RGB</option>
            <option value="hsl">HSL</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
        </div>

        {/* Inputs */}
        {renderInputs()}

        {/* Eyedropper */}
        <button
          onClick={handleEyedropper}
          className="h-8 w-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 text-gray-600 transition-colors"
          title="Pick color"
        >
          <Pipette className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  // VIEW: New Style
  if (view === "new_style") {
    return (
      <div
        ref={popover}
        className="fixed top-[20%] right-[340px] z-[9999] flex flex-col p-4 bg-white rounded-xl shadow-2xl border border-gray-200 w-56 animate-in fade-in zoom-in-95 duration-200 font-sans"
        style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setView("default")}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800">
            New Color Style
          </span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Name Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Name"
            value={newStyleName}
            onChange={(e) => setNewStyleName(e.target.value)}
            className="w-full p-2 text-sm border border-blue-500 rounded outline-none text-gray-800 placeholder:text-gray-400 focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Theme Toggle */}
        <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
          <button
            onClick={() => setIsLightMode(true)}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${
              isLightMode
                ? "bg-white shadow-sm text-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsLightMode(false)}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${
              !isLightMode
                ? "bg-white shadow-sm text-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>

        {renderPickerBody()}

        {/* Create Button */}
        <button
          onClick={() => {
            if (editingIndex !== null) {
              const updated = savedStyles.map((s, i) =>
                i === editingIndex
                  ? { name: newStyleName || s.name, value: localColor }
                  : s,
              );
              persistStyles(updated);
            } else {
              const next = [
                ...savedStyles,
                { name: newStyleName || "Untitled", value: localColor },
              ];
              persistStyles(next);
              onSaveStyle?.(newStyleName || "Untitled", localColor);
            }
            setView("default");
            setEditingIndex(null);
            setNewStyleName("");
          }}
          className="w-full py-2 bg-blue-400 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors text-sm mt-2"
        >
          {editingIndex !== null ? "Save" : "Create"}
        </button>

        <style>{`
          .custom-picker .react-colorful {
             width: 100%;
             height: auto;
             gap: 12px;
          }
          .custom-picker .react-colorful__saturation {
             border-radius: 8px;
             height: 140px;
             margin-bottom: 8px;
          }
          .custom-picker .react-colorful__hue,
          .custom-picker .react-colorful__alpha {
             height: 12px;
             border-radius: 6px;
             margin-bottom: 4px;
          }
          .custom-picker .react-colorful__pointer {
             width: 16px;
             height: 16px;
             border: 2px solid white;
             box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
        `}</style>
      </div>
    );
  }

  // VIEW: Default (Picker + List)
  return (
    <div
      ref={popover}
      className="fixed top-[20%] right-[340px] z-[9999] flex flex-col p-3 bg-white rounded-xl shadow-2xl border border-gray-200 w-56 animate-in fade-in zoom-in-95 duration-200 font-sans"
      style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}
    >
      {/* Header Tabs */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-800">Color</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded text-gray-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex p-1 bg-gray-100/80 rounded-lg select-none mb-4 gap-0.5">
        {[
          {
            id: "solid",
            label: "Solid",
            icon: (active: boolean) => (
              <div
                className={`w-4 h-4 rounded-full border ${
                  active
                    ? "bg-blue-500 border-blue-600"
                    : "bg-gray-200 border-gray-300"
                }`}
                style={
                  !active
                    ? {
                        background:
                          "linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)",
                      }
                    : {}
                }
              />
            ),
          },
          {
            id: "linear",
            label: "Linear Gradient",
            icon: (active: boolean) => (
              <div
                className="w-4 h-4 rounded-full border border-gray-300"
                style={{
                  background:
                    "linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)",
                }}
              />
            ),
          },
          {
            id: "radial",
            label: "Radial Gradient",
            icon: (active: boolean) => (
              <div
                className="w-4 h-4 rounded-full border border-gray-300"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, #e5e7eb 0%, #9ca3af 100%)",
                }}
              />
            ),
          },
          {
            id: "conic",
            label: "Conic Gradient",
            icon: (active: boolean) => (
              <div
                className="w-4 h-4 rounded-full border border-gray-300"
                style={{
                  background:
                    "conic-gradient(from 0deg, #e5e7eb, #9ca3af, #e5e7eb)",
                }}
              />
            ),
          },
        ].map((m) => {
          const isActive = mode === m.id;

          return (
            <div key={m.id} className="flex-1 flex items-center relative">
              <button
                onClick={() => handleModeChange(m.id as Mode)}
                className={`w-full flex items-center justify-center py-1.5 rounded-md transition-all relative z-10 ${
                  isActive
                    ? "bg-white shadow-sm ring-1 ring-black/5"
                    : "hover:bg-gray-200/50"
                }`}
                title={m.label}
              >
                {m.icon(isActive)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Picker Body */}
      {renderPickerBody()}

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-100 rounded-md outline-none focus:border-blue-500 text-gray-700 placeholder:text-gray-400"
        />
      </div>

      {/* Saved Styles List */}
      <div className="flex-1 overflow-y-auto max-h-[150px] space-y-1 mb-3">
        {savedStyles.length > 0 ? (
          savedStyles
            .filter(
              (s) =>
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.value.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((s, i) => (
              <div
                key={`${s.name}-${i}`}
                className="w-full flex items-center gap-3 p-1.5 hover:bg-gray-50 rounded-md transition-colors group"
              >
                <button
                  onClick={() => {
                    setLocalColor(s.value);
                    onChange(constructValue(mode, s.value));
                  }}
                  className="flex items-center gap-3 flex-1"
                >
                  <div
                    className="w-6 h-6 rounded-full border border-gray-200 shadow-sm"
                    style={{ backgroundColor: s.value }}
                  />
                  <span className="text-xs text-gray-600 font-medium">
                    {s.name ||
                      colord(s.value).toName({ closest: true }) ||
                      s.value}
                  </span>
                </button>
                {localColor === s.value && (
                  <Check className="w-3 h-3 text-blue-500" />
                )}
                <button
                  onClick={() => {
                    const next = savedStyles.filter((_, idx) => idx !== i);
                    persistStyles(next);
                  }}
                  className="p-1 rounded border border-gray-200 bg-gray-100 hover:bg-red-100 hover:border-red-200 text-gray-700 hover:text-red-700"
                  title="Remove"
                  aria-label="Remove style"
                >
                  <X className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    setEditingIndex(i);
                    setNewStyleName(s.name);
                    setLocalColor(s.value);
                    setView("new_style");
                  }}
                  className="p-1 rounded border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
                  title="Edit"
                  aria-label="Edit style"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            ))
        ) : (
          <div className="text-center py-4 text-xs text-gray-400">
            No saved styles
          </div>
        )}
      </div>

      {/* New Style Button */}
      <button
        onClick={() => {
          setEditingIndex(null);
          setNewStyleName("");
          setView("new_style");
        }}
        className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
      >
        New Style
      </button>

      <style>{`
          .custom-picker .react-colorful {
             width: 100%;
             height: auto;
             gap: 12px;
          }
          .custom-picker .react-colorful__saturation {
             border-radius: 8px;
             height: 140px;
             margin-bottom: 8px;
          }
          .custom-picker .react-colorful__hue,
          .custom-picker .react-colorful__alpha {
             height: 12px;
             border-radius: 6px;
             margin-bottom: 4px;
          }
          .custom-picker .react-colorful__pointer {
             width: 16px;
             height: 16px;
             border: 2px solid white;
             box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
        `}</style>
    </div>
  );
};
