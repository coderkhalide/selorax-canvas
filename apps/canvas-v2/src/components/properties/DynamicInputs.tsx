import React, { useMemo, useState, useEffect } from "react";
import { colord } from "colord";
import { Plus, Trash2, Upload, GripVertical } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { SettingSchema } from "../../types";
import { RichTextEditor } from "./RichTextEditor";
import { useFunnel } from "../../context/FunnelContext";
import { ColorPicker } from "../ui/ColorPicker";
import { IconPicker } from "../ui/IconPicker";
import ImageUpload from "../shared/ImageUpload";

const resolveCssVar = (val?: string): string | undefined => {
  if (!val) return undefined;
  const s = String(val);
  let resolved = s;
  if (s.startsWith("var(")) {
    const m = s.match(/var\((--[^)]+)\)/);
    const varName = m?.[1];
    if (varName) {
      resolved = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
    }
  }

  // Always try to return as hex if it's a valid color and not a gradient
  if (
    resolved &&
    !resolved.includes("gradient") &&
    colord(resolved).isValid()
  ) {
    return colord(resolved).toHex();
  }

  return resolved || undefined;
};

const ColorInput: React.FC<{
  value?: string;
  defaultValue?: string;
  onChange: (val: string) => void;
  presetColors: string[];
  compact?: boolean;
}> = ({ value, defaultValue, onChange, presetColors, compact }) => {
  const [open, setOpen] = useState(false);
  const raw = String(value ?? defaultValue ?? "#000000");
  const swatch = resolveCssVar(raw) || raw;
  const displayText = (() => {
    const v = String(value || "");
    if (v.includes("linear-gradient")) return "Linear";
    if (v.includes("radial-gradient")) return "Radial";
    if (v.includes("conic-gradient")) return "Conic";

    const r = resolveCssVar(v);

    try {
      return colord(r || v)
        .toHex()
        .toUpperCase();
    } catch {
      if (r && /^#/.test(r)) return r.toUpperCase();
      return r || v;
    }
  })();

  return (
    <div
      className={`flex items-center justify-between h-[38px] bg-white border border-gray-200 rounded px-2 relative ${compact ? "w-full" : ""}`}
    >
      <div className="relative flex-1 h-full flex items-center">
        <div
          className="h-5 w-full rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
          style={{ background: swatch }}
          onClick={() => setOpen(!open)}
        />
        {open && (
          <ColorPicker
            color={swatch}
            onChange={(c) => onChange(c)}
            onClose={() => setOpen(false)}
            presetColors={presetColors}
          />
        )}
      </div>
      {!compact && (
        <span className="ml-2 text-xs text-gray-500 font-mono">
          {displayText}
        </span>
      )}
    </div>
  );
};

export const DynamicInput: React.FC<{
  schema: SettingSchema;
  value: any;
  onChange: (val: any) => void;
  presetColors?: string[];
}> = ({ schema, value, onChange, presetColors = [] }) => {
  if (schema.type === "text")
    return (
      <input
        type="text"
        value={value || ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
        placeholder={schema.placeholder}
      />
    );
  if (schema.type === "code")
    return (
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white text-gray-900 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono min-h-[200px]"
        placeholder={schema.placeholder || "Enter code..."}
        spellCheck={false}
      />
    );
  if (schema.type === "textarea")
    return (
      <RichTextEditor
        content={value || ""}
        onChange={(html: string) => {
          let cleaned = html;
          if (cleaned.startsWith("<p>") && cleaned.endsWith("</p>"))
            cleaned = cleaned.substring(3, cleaned.length - 4);
          onChange(cleaned);
        }}
      />
    );
  if (schema.type === "number_slider")
    return (
      <div className="flex gap-2 items-center">
        <input
          type="range"
          min={schema.min}
          max={schema.max}
          step={schema.step}
          value={value || schema.default || 0}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(parseFloat(e.target.value))
          }
          className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <input
          type="number"
          value={value || 0}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(parseFloat(e.target.value))
          }
          className="w-12 bg-white border border-gray-200 rounded px-1 py-0.5 text-xs text-right text-gray-900"
        />
      </div>
    );
  if (schema.type === "select")
    return (
      <select
        value={value || schema.default}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(e.target.value)
        }
        className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
      >
        <option value="" disabled>
          Select...
        </option>
        {schema.options?.map((o: { label: string; value: string }) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  if (schema.type === "color")
    return (
      <ColorInput
        value={value}
        defaultValue={schema.default as string | undefined}
        onChange={(v) => onChange(v)}
        presetColors={presetColors}
      />
    );
  if (schema.type === "icon_group") {
    const val = value || {};
    const icon = val.icon || "CheckCircle2";
    const color = val.color || "#000000";

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <IconPicker
            value={icon}
            onChange={(newIcon) => onChange({ ...val, icon: newIcon })}
            hideName={true}
          />
        </div>
        <div className="w-[60px]">
          <ColorInput
            value={color}
            onChange={(c) => onChange({ ...val, color: c })}
            presetColors={presetColors}
            compact={true}
          />
        </div>
      </div>
    );
  }
  if (schema.type === "boolean")
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(!value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === "Enter" || e.key === " ") onChange(!value);
          }}
          role="switch"
          aria-checked={!!value}
          className={`w-8 h-4 rounded-full transition-colors duration-200 ease-in-out relative ${
            value ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <div
            className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out"
            style={{ transform: value ? "translateX(1rem)" : "translateX(0)" }}
          />
        </button>
        <span className="text-xs text-gray-500">{value ? "Yes" : "No"}</span>
      </div>
    );
  if (schema.type === "icon")
    return (
      <IconPicker
        value={value || ""}
        onChange={(val) => onChange(val)}
        hideName={schema.hiddenName}
      />
    );
  return null;
};

const SortableItem = ({
  item,
  onRemove,
  children,
}: {
  item: any;
  onRemove: () => void;
  children: React.ReactNode;
}) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="relative"
    >
      <div className="bg-gray-50 p-2 rounded border border-gray-200 relative group flex gap-2 items-start">
        <div
          className="mt-2 cursor-grab active:cursor-grabbing touch-none text-gray-400 hover:text-gray-600 flex-shrink-0"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </Reorder.Item>
  );
};

const SortableList = ({
  items: propItems,
  onChange,
  renderItem,
}: {
  items: any[];
  onChange: (items: any[]) => void;
  renderItem: (item: any, index: number) => React.ReactNode;
}) => {
  const [ids, setIds] = useState<string[]>(() =>
    propItems.map(() => crypto.randomUUID()),
  );

  useEffect(() => {
    if (propItems.length !== ids.length) {
      setIds(propItems.map(() => crypto.randomUUID()));
    }
  }, [propItems.length]);

  const items = useMemo(() => {
    if (propItems.length === ids.length) {
      return ids.map((id, i) => ({ id, val: propItems[i] }));
    }
    return propItems.map((item) => ({ id: crypto.randomUUID(), val: item }));
  }, [propItems, ids]);

  const handleReorder = (newOrder: { id: string; val: any }[]) => {
    setIds(newOrder.map((item) => item.id));
    onChange(newOrder.map((item) => item.val));
  };

  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={handleReorder}
      className="space-y-2 pl-2 border-l border-gray-200"
    >
      {items.map((wrapped, i) => (
        <SortableItem
          key={wrapped.id}
          item={wrapped}
          onRemove={() => {
            const newList = [...propItems];
            newList.splice(i, 1);
            onChange(newList);
          }}
        >
          {renderItem(wrapped.val, i)}
        </SortableItem>
      ))}
    </Reorder.Group>
  );
};

export const DynamicSettings: React.FC<{
  data: any;
  schema: Record<string, SettingSchema>;
  onChange: (key: string, val: any) => void;
}> = ({ data, schema, onChange }) => {
  const { schemes, currentSchemeId } = useFunnel();
  const activeScheme = schemes[currentSchemeId];
  const [uploadTarget, setUploadTarget] = useState<{
    key: string;
    index: number;
    subKey: string;
  } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleUploadComplete = (newFiles: any[]) => {
    if (!uploadTarget) {
      setShowUploadModal(false);
      return;
    }
    if (newFiles && newFiles.length > 0) {
      const lastUrl = newFiles[newFiles.length - 1];
      const { key, index, subKey } = uploadTarget;
      const list = ((data as any)[key] as any[]) || [];
      const item = list[index] || {};
      const updatedItem = { ...item, [subKey]: lastUrl };
      const next = [...list];
      next[index] = updatedItem;
      onChange(key, next);
    }
    setShowUploadModal(false);
    setUploadTarget(null);
  };

  const presetColors = useMemo(() => {
    const colors = new Set<string>();
    const settings = activeScheme?.settings || {};
    Object.values(settings).forEach((val) => {
      if (
        val &&
        typeof val === "string" &&
        (val.startsWith("#") || val.startsWith("rgb"))
      ) {
        colors.add(val);
      }
    });
    return Array.from(colors);
  }, [activeScheme]);

  return (
    <>
      <div className="space-y-4">
        {(Object.entries(schema) as Array<[string, SettingSchema]>).map(
          ([key, field]) => {
            if (field.conditionalDisplay) {
              const depVal = data[field.conditionalDisplay.field];
              if (depVal !== field.conditionalDisplay.value) return null;
            }
            if (field.type === "array" || field.type === "array_object") {
              const list = (data[key] as any[]) || [];
              return (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-400">
                      {field.label}
                    </label>
                    <button
                      onClick={() =>
                        onChange(key, [
                          ...list,
                          field.defaultItem ||
                            (field.itemType === "text" ? "New Item" : {}),
                        ])
                      }
                      className="text-xs text-blue-400 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <SortableList
                    items={list}
                    onChange={(newList) => onChange(key, newList)}
                    renderItem={(item, i) => (
                      <>
                        {field.type === "array" ? (
                          <DynamicInput
                            schema={{ type: field.itemType!, label: "" }}
                            value={item}
                            presetColors={presetColors}
                            onChange={(v: any) => {
                              const n = [...list];
                              n[i] = v;
                              onChange(key, n);
                            }}
                          />
                        ) : (
                          <div className="space-y-2 pr-6">
                            {Object.entries(field.itemSchema!).map(
                              ([subKey, subField]) => (
                                <div key={subKey}>
                                  <label className="text-[10px] text-gray-500 block mb-1">
                                    {subField.label}
                                  </label>
                                  {subField.type === "text" &&
                                  subKey === "image" ? (
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={item[subKey] || ""}
                                        onChange={(
                                          e: React.ChangeEvent<HTMLInputElement>,
                                        ) => {
                                          const n = [...list];
                                          n[i] = {
                                            ...item,
                                            [subKey]: e.target.value,
                                          };
                                          onChange(key, n);
                                        }}
                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
                                        placeholder="Image URL"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setUploadTarget({
                                            key,
                                            index: i,
                                            subKey,
                                          });
                                          setShowUploadModal(true);
                                        }}
                                        className="p-1.5 border border-gray-200 rounded bg-gray-50 hover:bg-gray-100 flex-shrink-0"
                                        title="Upload Image"
                                      >
                                        <Upload className="w-3 h-3 text-gray-600" />
                                      </button>
                                    </div>
                                  ) : (
                                    <DynamicInput
                                      schema={subField}
                                      value={item[subKey]}
                                      presetColors={presetColors}
                                      onChange={(v: any) => {
                                        const n = [...list];
                                        n[i] = { ...item, [subKey]: v };
                                        onChange(key, n);
                                      }}
                                    />
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </>
                    )}
                  />
                </div>
              );
            }
            return (
              <div key={key}>
                <label className="text-xs text-gray-400 block mb-1">
                  {field.label}
                </label>
                <DynamicInput
                  schema={field}
                  value={data[key]}
                  presetColors={presetColors}
                  onChange={(v: any) => onChange(key, v)}
                />
              </div>
            );
          },
        )}
      </div>
      {showUploadModal && (
        // @ts-ignore
        <ImageUpload
          setUploadedImage={handleUploadComplete}
          setUploadModal={setShowUploadModal}
          images={[]}
          oneSelect={true}
        />
      )}
    </>
  );
};
