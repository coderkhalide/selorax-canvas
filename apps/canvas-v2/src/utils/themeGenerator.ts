import { colord, extend } from "colord";
import mixPlugin from "colord/plugins/mix";
import namesPlugin from "colord/plugins/names";
import { ColorScheme } from "../types";

extend([mixPlugin, namesPlugin]);

export const generateSchemeFromBaseColor = (
  baseColor: string,
  schemeName: string = "Custom Scheme",
  fixedId?: string
): ColorScheme | null => {
  const base = colord(baseColor);
  if (!base.isValid()) return null;

  const id = fixedId || `scheme-${Date.now()}`;
  const name = schemeName.trim() || "Custom Scheme";
  
  const primary = base.toHex();
  const primaryHover = base.darken(0.12).toHex();
  const heading = base.darken(0.45).saturate(0.1).toHex();
  const text = base.darken(0.6).desaturate(0.2).toHex();
  const bg = base.lighten(0.85).desaturate(0.5).toHex();
  const border = base.lighten(0.8).desaturate(0.6).toHex();
  const shadow = heading;
  
  const inputBg = "#ffffff";
  const inputText = heading;
  const inputBorder = base.lighten(0.75).desaturate(0.6).toHex();
  const inputHoverBg = base.lighten(0.92).desaturate(0.6).toHex();
  
  const variantBg = "#ffffff";
  const variantText = heading;
  const variantBorder = border;
  const variantHoverBg = base.lighten(0.92).desaturate(0.6).toHex();
  const variantHoverText = heading;
  const variantHoverBorder = inputBorder;
  
  const selectedBg = primary;
  const selectedText = "#ffffff";
  const selectedBorder = primary;
  const selectedHoverBg = primaryHover;
  const selectedHoverText = "#ffffff";
  const selectedHoverBorder = primaryHover;

  return {
    id,
    name,
    settings: {
      background: bg,
      foreground_heading: heading,
      foreground: text,
      primary,
      primary_hover: primaryHover,
      border,
      shadow,
      primary_button_background: primary,
      primary_button_text: "#ffffff",
      primary_button_border: primary,
      primary_button_hover_background: primaryHover,
      primary_button_hover_text: "#ffffff",
      primary_button_hover_border: primaryHover,
      secondary_button_background: "transparent",
      secondary_button_text: heading,
      secondary_button_border: base.lighten(0.6).desaturate(0.6).toHex(),
      secondary_button_hover_background: base.lighten(0.92).desaturate(0.6).toHex(),
      secondary_button_hover_text: base.darken(0.5).toHex(),
      secondary_button_hover_border: base.lighten(0.5).desaturate(0.6).toHex(),
      input_background: inputBg,
      input_text_color: inputText,
      input_border_color: inputBorder,
      input_hover_background: inputHoverBg,
      variant_background_color: variantBg,
      variant_text_color: variantText,
      variant_border_color: variantBorder,
      variant_hover_background_color: variantHoverBg,
      variant_hover_text_color: variantHoverText,
      variant_hover_border_color: variantHoverBorder,
      selected_variant_background_color: selectedBg,
      selected_variant_text_color: selectedText,
      selected_variant_border_color: selectedBorder,
      selected_variant_hover_background_color: selectedHoverBg,
      selected_variant_hover_text_color: selectedHoverText,
      selected_variant_hover_border_color: selectedHoverBorder,
    },
  };
};
