export const getGradientTextStyle = (color) => {
  if (color && color.includes("gradient")) {
    return {
      backgroundImage: color,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
    };
  }
  return { color };
};

export const extractFirstColor = (color) => {
  if (!color || !color.includes("gradient")) return color;
  const match = color.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/i);
  return match ? match[0] : "#000000";
};
