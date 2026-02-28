import React, { useState, useMemo } from "react";
import { useFunnel } from "../../context/FunnelContext";
import { Check, Palette, Plus, ArrowLeft, Edit2, Database } from "lucide-react";
import { ColorScheme, ThemeSettings } from "../../types";
import { ColorPicker } from "../ui/ColorPicker";
import { colord } from "colord";
import { generateSchemeFromBaseColor } from "../../utils/themeGenerator";

export const ThemePanel: React.FC = () => {
  const { schemes, currentSchemeId, setScheme, updateScheme, addScheme } =
    useFunnel();
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);

  // Track open picker: { key: string } or null
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [newColor, setNewColor] = useState<string>("#22c55e");
  const [newName, setNewName] = useState<string>("Custom Green");

  const activeScheme = schemes[currentSchemeId];
  const editingScheme = editingSchemeId ? schemes[editingSchemeId] : null;

  // Extract currently used colors from the active scheme to pass as presets
  const presetColors = useMemo(() => {
    if (!editingScheme) return [];
    // Get unique colors values from settings
    const colors = new Set<string>();
    Object.values(editingScheme.settings).forEach((val) => {
      if (
        val &&
        typeof val === "string" &&
        (val.startsWith("#") || val.startsWith("rgb"))
      ) {
        colors.add(val);
      }
    });

    // Add custom colors
    if (editingScheme.customColors) {
      editingScheme.customColors.forEach((c) => {
        if (c.value) colors.add(c.value);
      });
    }

    return Array.from(colors);
  }, [editingScheme]);

  // Helper to update a specific setting in the editing scheme
  const handleColorChange = (key: keyof ThemeSettings, value: string) => {
    if (editingSchemeId) {
      updateScheme(editingSchemeId, {
        settings: {
          ...schemes[editingSchemeId].settings,
          [key]: value,
        },
      });
    }
  };

  // Helper to save a new style
  const handleSaveStyle = (name: string, color: string) => {
    if (editingSchemeId && schemes[editingSchemeId]) {
      const currentCustom = schemes[editingSchemeId].customColors || [];
      updateScheme(editingSchemeId, {
        customColors: [...currentCustom, { name, value: color }],
      });
    }
  };

  // Helper to render a color input row
  const renderColorInput = (
    label: string,
    key: keyof ThemeSettings,
    scheme: ColorScheme,
  ) => {
    const value = scheme.settings[key];
    const isPickerOpen = activePicker === key;

    return (
      <div
        className={`flex items-center justify-between group py-1 relative ${
          isPickerOpen ? "z-50" : "z-10"
        }`}
      >
        <label className="text-xs text-gray-600 font-medium group-hover:text-gray-900 transition-colors">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {/* Hex Input */}
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => handleColorChange(key, e.target.value)}
              className="w-24 h-8 text-xs bg-white border border-gray-200 rounded px-3 outline-none focus:border-blue-600 focus:bg-white text-gray-900 font-mono font-medium transition-all shadow-sm uppercase"
            />
          </div>

          {/* Color Picker Swatch Trigger */}
          <div className="relative">
            <div
              className="w-8 h-8 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors overflow-hidden relative"
              style={{ background: value }}
              onClick={() => setActivePicker(isPickerOpen ? null : key)}
            >
              {/* Invisible native input for fallback/accessibility if needed, but we rely on custom picker now */}
            </div>

            {/* Custom Popover Picker */}
            {isPickerOpen && (
              <ColorPicker
                color={value}
                onChange={(newColor) => handleColorChange(key, newColor)}
                onClose={() => setActivePicker(null)}
                presetColors={presetColors}
                onSaveStyle={handleSaveStyle}
              />
            )}
          </div>

          <button
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Dynamic Data"
          >
            <Database className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700" />
          </button>
        </div>
      </div>
    );
  };

  // --- EDITOR VIEW ---
  if (editingScheme && editingSchemeId) {
    return (
      <div className="flex flex-col h-full bg-white text-gray-900">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200">
          <button
            onClick={() => setEditingSchemeId(null)}
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="font-medium text-sm">
            Editing {editingScheme.name}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-8 no-scrollbar">
          {/* Global Colors */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Global Colors
            </h4>
            <div className="space-y-3 pl-1">
              {renderColorInput("Background", "background", editingScheme)}
              {renderColorInput(
                "Headings",
                "foreground_heading",
                editingScheme,
              )}
              {renderColorInput("Text", "foreground", editingScheme)}
              {renderColorInput("Primary", "primary", editingScheme)}
              {renderColorInput(
                "Primary Hover",
                "primary_hover",
                editingScheme,
              )}
              {renderColorInput("Borders", "border", editingScheme)}
              {renderColorInput("Shadow", "shadow", editingScheme)}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* Primary Button */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Primary Button
            </h4>
            <div className="space-y-3 pl-1">
              {renderColorInput(
                "Background",
                "primary_button_background",
                editingScheme,
              )}
              {renderColorInput("Text", "primary_button_text", editingScheme)}
              {renderColorInput(
                "Border",
                "primary_button_border",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Background",
                "primary_button_hover_background",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Text",
                "primary_button_hover_text",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Border",
                "primary_button_hover_border",
                editingScheme,
              )}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* Secondary Button */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Secondary Button
            </h4>
            <div className="space-y-3 pl-1">
              {renderColorInput(
                "Background",
                "secondary_button_background",
                editingScheme,
              )}
              {renderColorInput("Text", "secondary_button_text", editingScheme)}
              {renderColorInput(
                "Border",
                "secondary_button_border",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Background",
                "secondary_button_hover_background",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Text",
                "secondary_button_hover_text",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Border",
                "secondary_button_hover_border",
                editingScheme,
              )}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* Inputs & Forms */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Inputs & Forms
            </h4>
            <div className="space-y-3 pl-1">
              {renderColorInput(
                "Background",
                "input_background",
                editingScheme,
              )}
              {renderColorInput("Text", "input_text_color", editingScheme)}
              {renderColorInput("Border", "input_border_color", editingScheme)}
              {renderColorInput(
                "Hover Background",
                "input_hover_background",
                editingScheme,
              )}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* Variants (Cards/Sections) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Variants (Unselected)
            </h4>
            <div className="space-y-3 pl-1">
              {renderColorInput(
                "Background",
                "variant_background_color",
                editingScheme,
              )}
              {renderColorInput("Text", "variant_text_color", editingScheme)}
              {renderColorInput(
                "Border",
                "variant_border_color",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Background",
                "variant_hover_background_color",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Text",
                "variant_hover_text_color",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Border",
                "variant_hover_border_color",
                editingScheme,
              )}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* Selected Variants */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Variants (Selected)
            </h4>
            <div className="space-y-3 pl-1">
              {renderColorInput(
                "Background",
                "selected_variant_background_color",
                editingScheme,
              )}
              {renderColorInput(
                "Text",
                "selected_variant_text_color",
                editingScheme,
              )}
              {renderColorInput(
                "Border",
                "selected_variant_border_color",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Background",
                "selected_variant_hover_background_color",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Text",
                "selected_variant_hover_text_color",
                editingScheme,
              )}
              {renderColorInput(
                "Hover Border",
                "selected_variant_hover_border_color",
                editingScheme,
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Color Schemes
            </h3>
            <button
              className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-500"
              onClick={() => {
                const scheme = generateSchemeFromBaseColor(newColor, newName);
                if (scheme) {
                  addScheme(scheme, true);
                  setNewName("");
                }
              }}
              title="Create scheme from base color"
            >
              Create
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              placeholder="#22c55e"
              className="w-28 h-8 text-xs bg-white border border-gray-200 rounded px-2 outline-none focus:border-blue-600 focus:bg-white text-gray-900 font-mono"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            />
            <input
              type="text"
              placeholder="Custom Green"
              className="w-32 h-8 text-xs bg-white border border-gray-200 rounded px-2 outline-none focus:border-blue-600 focus:bg-white text-gray-900"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Object.values(schemes).map((scheme: ColorScheme) => {
            const isActive = scheme.id === currentSchemeId;
            return (
              <div
                key={scheme.id}
                className={`group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border-2 ${
                  isActive
                    ? "border-blue-500 shadow-md scale-[1.02]"
                    : "border-transparent hover:border-gray-600 hover:shadow-sm"
                }`}
                onClick={() => setScheme(scheme.id)}
              >
                {/* Visual Preview */}
                <div
                  className="h-20 w-full p-3 flex flex-col justify-between"
                  style={{ backgroundColor: scheme.settings.background }}
                >
                  <div className="flex gap-1.5 justify-center mt-1">
                    <span
                      className="text-2xl font-bold leading-none"
                      style={{ color: scheme.settings.foreground_heading }}
                    >
                      Aa
                    </span>
                  </div>
                  <div className="flex justify-center gap-1">
                    <div
                      className="w-4 h-1.5 rounded-full"
                      style={{ backgroundColor: scheme.settings.primary }}
                    ></div>
                    <div
                      className="w-4 h-1.5 rounded-full border border-current"
                      style={{
                        color: scheme.settings.foreground,
                        borderColor: "currentColor",
                      }}
                    ></div>
                  </div>
                </div>

                {/* Footer Section */}
                <div className="p-2 bg-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[80px]">
                    {scheme.name}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSchemeId(scheme.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-900"
                      title="Customize"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Active Indicator (If not hovering/editing, or maybe just always show for active) */}
                  {isActive && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white p-0.5 rounded-full shadow-lg pointer-events-none">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <div className="flex gap-2 items-start">
          <Palette className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Select a scheme to apply it. Click the edit icon (pencil) to
            customize specific colors.
          </p>
        </div>
      </div>
    </div>
  );
};
