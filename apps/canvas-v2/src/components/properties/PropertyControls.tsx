import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  Link,
  Unlink,
  Square,
  Scan,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { ColorPicker } from "../ui/ColorPicker";
import { colord } from "colord";

export const Accordion: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onRemove?: () => void;
}> = ({ title, icon, children, defaultOpen = false, onRemove }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {icon}
          {title}
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="hidden group-hover:block text-gray-400 hover:text-red-400"
            title="Reset Section"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="p-3 pt-0 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

export const SizeInput: React.FC<{
  label: string;
  value: string | number | undefined;
  onChange: (val: string | undefined) => void;
  onDelete?: () => void;
}> = ({ label, value, onChange, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const getValueMode = (val: string | number | undefined) => {
    if (!val || val === "auto") return "Auto";
    if (val === "100%") return "Fill";
    if (val === "fit-content") return "Fit";
    if (String(val).endsWith("%")) return "Rel";
    if (String(val).endsWith("vw") || String(val).endsWith("vh")) return "View";
    return "Fixed";
  };
  const mode = getValueMode(value);
  const displayValue =
    mode === "Fixed" || mode === "Rel"
      ? String(value || "").replace(/px|%|vw|vh/g, "")
      : "";
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (mode === "Fixed") onChange(val ? `${val}px` : undefined);
    else if (mode === "Rel") onChange(val ? `${val}%` : undefined);
    else if (mode === "View") onChange(val ? `${val}vh` : undefined);
    else onChange(val);
  };
  return (
    <div className="flex items-center justify-between mb-2 group">
      <label
        className="text-xs text-gray-600 w-20 flex items-center gap-1 truncate"
        title={label}
      >
        {label}
        {onDelete && (
          <button
            onClick={onDelete}
            className="hidden group-hover:block text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </label>
      <div className="flex-1 flex gap-2">
        <div className="flex-1 bg-white border border-gray-200 rounded flex items-center overflow-hidden focus-within:border-blue-500 transition-colors">
          <input
            type="number"
            value={displayValue}
            onChange={handleInputChange}
            className="w-full bg-transparent p-1.5 text-xs text-gray-900 outline-none"
            placeholder="Auto"
          />
        </div>
        <select
          value={mode}
          onChange={(e) => {
            const m = e.target.value;
            if (m === "Auto") onChange("auto");
            else if (m === "Fill") onChange("100%");
            else if (m === "Fit") onChange("fit-content");
            else if (m === "Rel") onChange("50%");
            else if (m === "View") onChange("50vh");
            else onChange("100px");
          }}
          className="bg-white border-l border-gray-200 text-xs text-gray-700 px-1 hover:bg-gray-100 cursor-pointer outline-none transition-colors"
        >
          <option value="Fixed">px</option>
          <option value="Rel">%</option>
          <option value="View">vh</option>
          <option value="Auto">Auto</option>
          <option value="Fill">Fill</option>
          <option value="Fit">Fit</option>
        </select>
      </div>
    </div>
  );
};

export const QuadInput: React.FC<{
  label: string;
  values?: { top?: string; right?: string; bottom?: string; left?: string };
  value?: any;
  onChange: (values: any) => void;
  labels?: string[];
}> = ({ label, values, value, onChange, labels = ["T", "R", "B", "L"] }) => {
  const parseValue = (
    val:
      | string
      | number
      | { top?: string; right?: string; bottom?: string; left?: string }
      | undefined,
  ) => {
    if (val === undefined || val === null || val === "") {
      return { top: "", right: "", bottom: "", left: "" };
    }
    if (typeof val === "object") {
      return {
        top: val.top || "",
        right: val.right || "",
        bottom: val.bottom || "",
        left: val.left || "",
      };
    }
    const str = String(val);
    const parts = str.replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length === 1)
      return {
        top: parts[0],
        right: parts[0],
        bottom: parts[0],
        left: parts[0],
      };
    if (parts.length === 2)
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[0],
        left: parts[1],
      };
    if (parts.length === 3)
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[1],
      };
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  };

  const internalValues = values || parseValue(value);
  const keys = ["top", "right", "bottom", "left"];

  const getUnit = (val: string) => {
    if (!val) return "px";
    if (val === "auto") return "auto";
    if (val.endsWith("%")) return "%";
    if (val.endsWith("rem")) return "rem";
    if (val.endsWith("em")) return "em";
    if (val.endsWith("vh")) return "vh";
    if (val.endsWith("vw")) return "vw";
    return "px";
  };

  const getNumber = (val: string) => {
    if (!val || val === "auto") return "";
    return val.replace(/px|%|rem|em|vh|vw/g, "");
  };

  // Initialize unit from top value
  const [unit, setUnit] = useState(getUnit(internalValues.top || ""));

  const areAllEqual =
    internalValues.top === internalValues.right &&
    internalValues.right === internalValues.bottom &&
    internalValues.bottom === internalValues.left;

  const [isLinked, setIsLinked] = useState(areAllEqual);

  useEffect(() => {
    if (!areAllEqual) {
      setIsLinked(false);
    }
  }, [areAllEqual]);

  // Sync unit with external value changes if needed (simplified to top)
  useEffect(() => {
    const newUnit = getUnit(internalValues.top || "");
    if (newUnit !== unit) {
      // Optional: only update if we want to track external changes strictly
      // For now, let's update it to keep UI consistent
      setUnit(newUnit);
    }
  }, [internalValues.top]);

  const handleChange = (
    key: string,
    numVal: string,
    currentUnit: string = unit,
  ) => {
    let newVal: string | undefined = undefined;

    if (currentUnit === "auto") {
      newVal = "auto";
    } else {
      newVal = numVal ? `${numVal}${currentUnit}` : undefined;
    }

    // Fallback to 0 + unit if undefined/empty?
    // Usually we want to allow empty -> undefined, but for CSS valid values usually need 0.
    // However, if user clears input, maybe they want to type new number.
    // Let's pass empty string if empty.
    if (newVal === undefined) newVal = "";

    if (isLinked) {
      const newValues = {
        top: newVal,
        right: newVal,
        bottom: newVal,
        left: newVal,
      };
      onChange(newVal || "0px");
    } else {
      const newValues = { ...internalValues, [key]: newVal };
      const t = newValues.top || "0px";
      const r = newValues.right || "0px";
      const b = newValues.bottom || "0px";
      const l = newValues.left || "0px";
      if (t === r && r === b && b === l) {
        onChange(t);
      } else {
        onChange(`${t} ${r} ${b} ${l}`);
      }
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);

    if (newUnit === "auto") {
      // Set all to auto?
      if (isLinked) handleChange("top", "", "auto");
      else {
        // Update all keys to auto
        const newValues = {
          top: "auto",
          right: "auto",
          bottom: "auto",
          left: "auto",
        };
        onChange("auto");
      }
    } else {
      // Convert current values to new unit (preserve number)
      if (isLinked) {
        const num = getNumber(internalValues.top || "");
        handleChange("top", num, newUnit);
      } else {
        // Update all with new unit
        const newValues = { ...internalValues };
        let hasChanges = false;
        keys.forEach((k) => {
          const val = internalValues[k as keyof typeof internalValues] || "";
          const num = getNumber(val);
          newValues[k as keyof typeof internalValues] = num
            ? `${num}${newUnit}`
            : `0${newUnit}`;
          hasChanges = true;
        });

        if (hasChanges) {
          const t = newValues.top || "0px";
          const r = newValues.right || "0px";
          const b = newValues.bottom || "0px";
          const l = newValues.left || "0px";
          onChange(`${t} ${r} ${b} ${l}`);
        }
      }
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    key: string,
  ) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const val = getNumber(
        internalValues[key as keyof typeof internalValues] || "",
      );
      const current = parseFloat(val) || 0;
      const step = e.shiftKey ? 10 : 1;
      const next = e.key === "ArrowUp" ? current + step : current - step;
      handleChange(key, String(Math.max(0, next)));
    }
  };

  const handleToggle = (linked: boolean) => {
    setIsLinked(linked);
    if (linked) {
      const val =
        internalValues.top ||
        internalValues.right ||
        internalValues.bottom ||
        internalValues.left ||
        "";
      const num = getNumber(val);
      const u = getUnit(val);
      setUnit(u);
      handleChange("top", num, u);
    }
  };

  const UnitSelector = () => (
    <select
      value={unit}
      onChange={(e) => handleUnitChange(e.target.value)}
      className="bg-gray-50 border-l border-gray-200 text-xs text-gray-700 px-1 hover:bg-gray-100 cursor-pointer outline-none transition-colors w-12 text-center"
      title="Unit"
    >
      <option value="px">px</option>
      <option value="%">%</option>
      <option value="rem">rem</option>
      <option value="em">em</option>
      <option value="vh">vh</option>
      <option value="vw">vw</option>
      <option value="auto">auto</option>
    </select>
  );

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-gray-600 font-medium">{label}</label>
        <div className="flex items-center gap-2">
          {isLinked && (
            <div className="flex items-center bg-gray-100 rounded border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all overflow-hidden">
              <input
                type="text"
                value={getNumber(internalValues.top || "")}
                onChange={(e) => handleChange("top", e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "top")}
                className="w-12 bg-transparent px-2 py-1 text-xs text-gray-900 text-center outline-none"
                placeholder={unit === "auto" ? "Auto" : "0"}
                disabled={unit === "auto"}
              />
              <UnitSelector />
            </div>
          )}
          <div className="bg-gray-100 p-0.5 rounded-md flex items-center border border-gray-200">
            <button
              onClick={() => handleToggle(true)}
              className={`p-1 rounded-sm transition-all ${
                isLinked
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title="Link sides"
            >
              <Square size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => handleToggle(false)}
              className={`p-1 rounded-sm transition-all ${
                !isLinked
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title="Unlink sides"
            >
              <Scan size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {!isLinked && (
        <div className="flex items-start gap-2 animate-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-4 gap-2 flex-1">
            {keys.map((side, index) => (
              <div key={side} className="flex flex-col items-center gap-1">
                <div className="bg-gray-100 rounded border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all w-full">
                  <input
                    type="text"
                    value={getNumber(
                      internalValues[side as keyof typeof internalValues] || "",
                    )}
                    onChange={(e) => handleChange(side, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, side)}
                    className="w-full bg-transparent px-1 py-1.5 text-xs text-gray-900 text-center outline-none"
                    placeholder={unit === "auto" ? "Auto" : "0"}
                    disabled={unit === "auto"}
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-medium uppercase">
                  {labels[index]}
                </span>
              </div>
            ))}
          </div>
          {/* Unit Selector for Unlinked Mode - Right Side */}
          <div className="flex flex-col gap-1 pt-[1px]">
            <div className="bg-gray-100 rounded border border-gray-200 overflow-hidden h-[29px] flex items-center">
              <UnitSelector />
            </div>
            <span className="text-[10px] text-gray-400 font-medium uppercase text-center">
              Unit
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const TransformControl: React.FC<{
  style: React.CSSProperties;
  onChange: (key: keyof React.CSSProperties, val: any) => void;
}> = ({ style, onChange }) => {
  const parseTransform = (str: string | undefined) => {
    const t = { scale: 1, rotate: 0 };
    if (!str) return t;
    const scaleMatch = str.match(/scale\(([^)]+)\)/);
    if (scaleMatch) t.scale = parseFloat(scaleMatch[1]);
    const rotateMatch = str.match(/rotate\(([^)]+)deg\)/);
    if (rotateMatch) t.rotate = parseFloat(rotateMatch[1]);
    return t;
  };
  const [t, setT] = useState(parseTransform(style.transform));
  useEffect(() => setT(parseTransform(style.transform)), [style.transform]);
  const update = (key: keyof typeof t, val: number) => {
    const newT = { ...t, [key]: val };
    setT(newT);
    const transforms = [];
    if (newT.scale !== 1) transforms.push(`scale(${newT.scale})`);
    if (newT.rotate !== 0) transforms.push(`rotate(${newT.rotate}deg)`);
    onChange("transform", transforms.length ? transforms.join(" ") : undefined);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-600">Scale</label>
        <input
          type="number"
          step="0.1"
          value={t.scale}
          onChange={(e) => update("scale", parseFloat(e.target.value))}
          className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 outline-none"
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-600">Rotate</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="360"
            value={t.rotate}
            onChange={(e) => update("rotate", parseFloat(e.target.value))}
            className="h-1 bg-gray-200 rounded appearance-none w-20"
          />
          <input
            type="number"
            value={t.rotate}
            onChange={(e) => update("rotate", parseFloat(e.target.value))}
            className="w-12 bg-white border border-gray-200 rounded px-1 py-1 text-xs text-right text-gray-900 outline-none"
          />
          <span className="text-[10px] text-gray-400">deg</span>
        </div>
      </div>
    </div>
  );
};

export const PositionControl: React.FC<{
  style: React.CSSProperties;
  onChange: (key: keyof React.CSSProperties, val: any) => void;
}> = ({ style, onChange }) => {
  const position = style.position || "static";
  const showPositionInputs = [
    "absolute",
    "relative",
    "fixed",
    "sticky",
  ].includes(position);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-600">Type</label>
        <select
          value={position}
          onChange={(e) => onChange("position", e.target.value)}
          className="w-28 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 outline-none"
        >
          <option value="static">Static</option>
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
          <option value="fixed">Fixed</option>
          <option value="sticky">Sticky</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-600">Z-Index</label>
        <input
          type="number"
          value={style.zIndex || 0}
          onChange={(e) => onChange("zIndex", e.target.value)}
          className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900 outline-none"
        />
      </div>

      {showPositionInputs && (
        <div className="pt-2">
          <label className="text-xs text-gray-600 mb-2 block">Offsets</label>
          <div className="grid grid-cols-4 gap-1">
            {/* Top */}
            <div className="flex flex-col items-center gap-1">
              <input
                type="number"
                value={style.top ? String(style.top).replace("px", "") : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange("top", val ? `${val}px` : undefined);
                }}
                placeholder="-"
                className="w-full bg-white border border-gray-200 rounded px-1 py-1.5 text-xs text-gray-900 text-center focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400">T</span>
            </div>

            {/* Right */}
            <div className="flex flex-col items-center gap-1">
              <input
                type="number"
                value={style.right ? String(style.right).replace("px", "") : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange("right", val ? `${val}px` : undefined);
                }}
                placeholder="-"
                className="w-full bg-white border border-gray-200 rounded px-1 py-1.5 text-xs text-gray-900 text-center focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400">R</span>
            </div>

            {/* Bottom */}
            <div className="flex flex-col items-center gap-1">
              <input
                type="number"
                value={
                  style.bottom ? String(style.bottom).replace("px", "") : ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onChange("bottom", val ? `${val}px` : undefined);
                }}
                placeholder="-"
                className="w-full bg-white border border-gray-200 rounded px-1 py-1.5 text-xs text-gray-900 text-center focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400">B</span>
            </div>

            {/* Left */}
            <div className="flex flex-col items-center gap-1">
              <input
                type="number"
                value={style.left ? String(style.left).replace("px", "") : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange("left", val ? `${val}px` : undefined);
                }}
                placeholder="-"
                className="w-full bg-white border border-gray-200 rounded px-1 py-1.5 text-xs text-gray-900 text-center focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400">L</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ShadowControl: React.FC<{
  value: string | undefined;
  onChange: (val: string | undefined) => void;
  onOpenColorPicker?: (
    color: string,
    onChange: (newColor: string) => void,
  ) => void;
}> = ({ value, onChange, onOpenColorPicker }) => {
  const [activeColorPicker, setActiveColorPicker] = useState(false);
  const [activeType, setActiveType] = useState<"Box" | "Realistic">("Box");

  const parse = (val: string | undefined) => {
    if (!val || val === "none") {
      return {
        hasShadow: false,
        type: activeType,
        inset: false,
        x: 0,
        y: 1,
        blur: 2,
        spread: 0,
        color: "#000000",
        opacity: 0.25,
      };
    }
    const isInset = val.includes("inset");
    const clean = val.replace("inset", "").trim();
    const parts = [];
    let current = "";
    let inParen = 0;
    for (const char of clean) {
      if (char === "(") inParen++;
      if (char === ")") inParen--;
      if (char === " " && inParen === 0) {
        if (current) parts.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    if (current) parts.push(current);

    let x = 0,
      y = 0,
      blur = 0,
      spread = 0;
    let color = "#000000";
    const lengths: number[] = [];

    parts.forEach((p) => {
      if (/^-?[\d\.]+(px|em|rem|%|vh|vw)?$/.test(p) || p === "0") {
        lengths.push(parseFloat(p));
      } else {
        color = p;
      }
    });

    if (lengths.length >= 2) {
      x = lengths[0];
      y = lengths[1];
    }
    if (lengths.length >= 3) blur = lengths[2];
    if (lengths.length >= 4) spread = lengths[3];

    const c = colord(color);
    return {
      hasShadow: true,
      type: activeType, // Use state instead of default "Box"
      inset: isInset,
      x,
      y,
      blur,
      spread,
      color: c.toHex(),
      opacity: c.alpha(),
    };
  };

  const shadow = parse(value);

  const update = (changes: Partial<typeof shadow>) => {
    // If type is changing, update local state
    if (changes.type) {
      setActiveType(changes.type as "Box" | "Realistic");
      // Don't need to update CSS string if only type changed, as type isn't part of CSS box-shadow
      // But we might want to force a re-render or just let state handle it
      return;
    }

    const next = { ...shadow, ...changes };
    if (!next.hasShadow) {
      onChange(undefined);
      return;
    }
    const c = colord(next.color).alpha(next.opacity).toRgbString();
    const val = `${next.inset ? "inset " : ""}${next.x}px ${next.y}px ${next.blur}px ${next.spread}px ${c}`;
    onChange(val);
  };

  if (!shadow.hasShadow) {
    return (
      <div className="flex items-center justify-between mb-4">
        <label className="text-xs text-gray-600 font-medium">Shadows</label>
        <button
          onClick={() => update({ hasShadow: true })}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 transition-colors"
        >
          <Square className="w-3 h-3 text-gray-400" />
          Add...
        </button>
      </div>
    );
  }

  const Stepper = ({ label, val, onValChange }: any) => (
    <div className="flex items-center justify-between">
      <label className="text-xs text-gray-500 w-12">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={val}
          onChange={(e) => onValChange(Number(e.target.value))}
          className="w-16 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-center outline-none"
        />
        <div className="flex bg-gray-100 rounded border border-gray-200">
          <button
            onClick={() => onValChange(val - 1)}
            className="p-1.5 hover:bg-white rounded-l text-gray-500 border-r border-gray-200 transition-colors"
          >
            <Minus size={10} />
          </button>
          <button
            onClick={() => onValChange(val + 1)}
            className="p-1.5 hover:bg-white rounded-r text-gray-500 transition-colors"
          >
            <Plus size={10} />
          </button>
        </div>
      </div>
    </div>
  );

  const Slider = ({ label, val, onValChange, min = 0, max = 100 }: any) => (
    <div className="flex items-center justify-between">
      <label className="text-xs text-gray-500 w-16">{label}</label>
      <div className="flex items-center gap-3 flex-1">
        <input
          type="number"
          value={val}
          onChange={(e) => onValChange(Number(e.target.value))}
          className="w-12 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-center outline-none"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={val}
          onChange={(e) => onValChange(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 mb-4">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-600 font-medium">Shadows</label>
        <button
          onClick={() => onChange(undefined)}
          className="text-gray-400 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Type Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500">Type</label>
        <div className="flex bg-gray-100 rounded p-0.5 border border-gray-200">
          <button
            onClick={() => update({ type: "Box" })}
            className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${
              shadow.type === "Box"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Box
          </button>
          <button
            onClick={() => update({ type: "Realistic" })}
            className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${
              shadow.type === "Realistic"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Realistic
          </button>
        </div>
      </div>

      {/* Position Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500">Position</label>
        <div className="flex bg-gray-100 rounded p-0.5 border border-gray-200">
          <button
            onClick={() => update({ inset: false })}
            className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${
              !shadow.inset
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Outside
          </button>
          <button
            onClick={() => update({ inset: true })}
            className={`px-3 py-1 rounded text-[10px] font-medium transition-all ${
              shadow.inset
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Inside
          </button>
        </div>
      </div>

      {/* Color */}
      <div className="flex items-center justify-between relative">
        <label className="text-xs text-gray-500">Color</label>
        <div
          className="flex items-center gap-2 border border-blue-400 rounded px-2 py-1 bg-gray-50 w-40 cursor-pointer"
          onClick={() => {
            if (onOpenColorPicker) {
              const c = colord(shadow.color)
                .alpha(shadow.opacity)
                .toRgbString();
              onOpenColorPicker(c, (newColor) => {
                const parsed = colord(newColor);
                update({ color: parsed.toHex(), opacity: parsed.alpha() });
              });
            } else {
              setActiveColorPicker(!activeColorPicker);
            }
          }}
        >
          <div
            className="w-4 h-4 rounded shadow-sm border border-gray-300"
            style={{ background: shadow.color, opacity: shadow.opacity }}
          />
          <span className="text-xs font-mono flex-1 uppercase">
            {shadow.color.replace("#", "")}
          </span>
          <span className="text-[10px] text-gray-400">
            {Math.round(shadow.opacity * 100)}%
          </span>
        </div>
        {activeColorPicker && !onOpenColorPicker && (
          <div className="absolute top-full right-0 mt-2 z-50">
            <ColorPicker
              color={colord(shadow.color).alpha(shadow.opacity).toRgbString()}
              onChange={(c) => {
                const parsed = colord(c);
                update({ color: parsed.toHex(), opacity: parsed.alpha() });
              }}
              onClose={() => setActiveColorPicker(false)}
            />
          </div>
        )}
      </div>

      {/* Inputs */}
      <div className="space-y-2">
        <Stepper
          label="X"
          val={shadow.x}
          onValChange={(v: number) => update({ x: v })}
        />
        <Stepper
          label="Y"
          val={shadow.y}
          onValChange={(v: number) => update({ y: v })}
        />
        {shadow.type === "Box" ? (
          <>
            <Stepper
              label="Blur"
              val={shadow.blur}
              onValChange={(v: number) => update({ blur: v })}
            />
            <Stepper
              label="Spread"
              val={shadow.spread}
              onValChange={(v: number) => update({ spread: v })}
            />
          </>
        ) : (
          <>
            <Slider
              label="Diffusion"
              val={shadow.blur}
              onValChange={(v: number) => update({ blur: v })}
              max={100}
            />
            <Slider
              label="Focus"
              val={shadow.spread}
              onValChange={(v: number) => update({ spread: v })}
              min={-50}
              max={50}
            />
          </>
        )}
      </div>
    </div>
  );
};
