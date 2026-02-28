import React, { useRef } from "react";
import { EditableText } from "./EditableText";
import * as Icons from "lucide-react";
import { getGradientTextStyle } from "./styleUtils";

const DynamicIcon = ({ name, size = 24, color, className }) => {
  const IconCmp = Icons[name] || Icons.HelpCircle;
  const isGradient = color?.includes("gradient");

  if (isGradient) {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: size,
          height: size,
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: color,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCmp size={size} stroke="currentColor" fill="currentColor" />
        </span>
        <IconCmp size={size} style={{ opacity: 0 }} />
      </span>
    );
  }

  return <IconCmp size={size} style={{ color }} className={className} />;
};

const SequenceComponent = ({
  element,
  onUpdate,
  isPreview,
  deviceView = "desktop",
}) => {
  const isMobile = deviceView === "mobile";

  const {
    items = [],
    layout = "vertical-boxes",
    pyramidColor = "var(--color-input-background)",
    textColor = "var(--color-foreground)",
    numberColor = "var(--color-primary)",
    lineColor = "var(--color-border)",
    gap = 24,
    rowPadding = 16,
    textSize = 16,
    mobileRowPadding = 12,
    mobileTextSize = 14,
    mobileGap = 16,
    markerType = "number", // "number", "icon", "dot"
  } = element.data || {};

  const elementRef = useRef(element);
  elementRef.current = element;

  const pad = isMobile ? mobileRowPadding : rowPadding;
  const fz = isMobile ? mobileTextSize : textSize;
  const gridGap = isMobile ? mobileGap : gap;

  const getBgStyle = (color) => {
    if (!color) return {};
    if (color.includes("gradient")) return { background: color };
    if (color.startsWith("var")) return { background: color };
    return { backgroundColor: color };
  };

  const updateItem = (index, field, value) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = { ...next[index], [field]: value };
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };

  const renderMarkerContent = (item, index, size) => {
    if (markerType === "icon") {
      return (
        <DynamicIcon
          name={item.icon || "Check"}
          size={size * 0.6}
          color={numberColor}
        />
      );
    }
    if (markerType === "number") {
      return (
        <EditableText
          tagName="span"
          className="font-bold leading-none"
          style={{
            ...getGradientTextStyle(numberColor),
            fontSize: `${size * 0.5}px`,
          }}
          html={item.number || String(index + 1)}
          editable={!isPreview}
          onBlur={(e) => updateItem(index, "number", e.currentTarget.innerHTML)}
        />
      );
    }
    return null;
  };

  const renderVerticalBoxes = () => {
    const isDot = markerType === "dot";
    const markerSize = isDot ? (isMobile ? 16 : 20) : isMobile ? 32 : 40;

    return (
      <div className="flex flex-col w-full relative py-10">
        <div
          className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 transform md:-translate-x-1/2"
          style={{ ...getBgStyle(lineColor) }}
        />

        {items.map((item, index) => {
          const isEven = index % 2 === 0;
          return (
            <div
              key={index}
              className="flex flex-col md:flex-row w-full relative items-stretch min-h-[80px]"
              style={{ marginBottom: index === items.length - 1 ? 0 : gridGap }}
            >
              <div
                className="absolute left-4 md:left-1/2 transform -translate-x-1/2 z-10 flex items-center justify-center"
                style={{
                  top: "50%",
                  marginTop: "-1px",
                }}
              >
                <div
                  className={`rounded-full border-2 relative z-20 flex items-center justify-center ${!isDot ? "shadow-sm" : ""}`}
                  style={{
                    width: markerSize,
                    height: markerSize,
                    borderColor: lineColor,
                    ...getBgStyle(pyramidColor),
                    transform: "translateY(-50%)",
                  }}
                >
                  {!isDot && renderMarkerContent(item, index, markerSize)}
                </div>
              </div>

              <div
                className={`flex-1 w-full pl-12 md:pl-0 flex flex-col justify-center ${
                  isEven
                    ? "md:order-1 md:text-right md:pr-[128px]"
                    : "md:order-2 md:text-left md:pl-[128px]"
                }`}
              >
                <div className="relative w-full">
                  <div
                    className={`hidden md:block absolute top-1/2 h-0.5 transform -translate-y-1/2 ${
                      isEven ? "-right-16" : "-left-16"
                    }`}
                    style={{
                      ...getBgStyle(lineColor),
                      width: "64px",
                    }}
                  />

                  <div
                    className="rounded-lg shadow-sm group hover:shadow-md transition-shadow inline-block w-full"
                    style={{
                      ...getBgStyle(pyramidColor),
                      padding: `${pad}px`,
                    }}
                  >
                    <EditableText
                      tagName="div"
                      className="font-medium leading-snug"
                      style={{
                        ...getGradientTextStyle(textColor),
                        fontSize: `${fz}px`,
                      }}
                      html={item.text}
                      editable={!isPreview}
                      onBlur={(e) =>
                        updateItem(index, "text", e.currentTarget.innerHTML)
                      }
                    />
                    {item.subtext && (
                      <EditableText
                        tagName="div"
                        className="mt-3 opacity-80 border-t pt-2"
                        style={{
                          borderColor: lineColor,
                          ...getGradientTextStyle(textColor),
                          fontSize: `${fz}px`,
                        }}
                        html={item.subtext}
                        editable={!isPreview}
                        onBlur={(e) =>
                          updateItem(
                            index,
                            "subtext",
                            e.currentTarget.innerHTML,
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`flex-1 hidden md:block ${
                  isEven ? "md:order-2" : "md:order-1"
                }`}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderVerticalLeft = () => {
    const isDot = markerType === "dot";
    const markerSize = isDot ? (isMobile ? 16 : 20) : isMobile ? 32 : 40;
    const LINE_HEIGHT_FACTOR = 1.375;
    const topOffset = pad + (fz * LINE_HEIGHT_FACTOR) / 2;

    return (
      <div className="flex flex-col w-full relative py-4 md:py-6">
        <div
          className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5"
          style={{ ...getBgStyle(lineColor) }}
        />

        {items.map((item, index) => {
          return (
            <div
              key={index}
              className="flex w-full relative items-start"
              style={{ marginBottom: index === items.length - 1 ? 0 : gridGap }}
            >
              <div
                className="absolute left-4 md:left-6 transform -translate-x-1/2 z-10 flex items-center justify-center rounded-full border-2"
                style={{
                  top: topOffset,
                  marginTop: -markerSize / 2,
                  width: markerSize,
                  height: markerSize,
                  borderColor: lineColor,
                  ...getBgStyle(pyramidColor),
                }}
              >
                {!isDot && renderMarkerContent(item, index, markerSize)}
              </div>

              <div
                className="absolute left-4 md:left-6 h-0.5 transform -translate-y-1/2"
                style={{
                  top: topOffset,
                  ...getBgStyle(lineColor),
                  width: isMobile ? "24px" : "40px",
                }}
              />

              <div className={`w-full ${isMobile ? "pl-[44px]" : "pl-[56px]"}`}>
                <div
                  className="rounded-lg shadow-sm w-full"
                  style={{ ...getBgStyle(pyramidColor), padding: `${pad}px` }}
                >
                  <EditableText
                    tagName="div"
                    className="font-medium"
                    style={{
                      ...getGradientTextStyle(textColor),
                      fontSize: `${fz}px`,
                    }}
                    html={item.text}
                    editable={!isPreview}
                    onBlur={(e) =>
                      updateItem(index, "text", e.currentTarget.innerHTML)
                    }
                  />
                  {item.subtext && (
                    <EditableText
                      tagName="div"
                      className="mt-2 opacity-80 text-sm"
                      style={{
                        ...getGradientTextStyle(textColor),
                      }}
                      html={item.subtext}
                      editable={!isPreview}
                      onBlur={(e) =>
                        updateItem(index, "subtext", e.currentTarget.innerHTML)
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListSkewed = () => {
    return (
      <div className="flex flex-col w-full" style={{ gap: `${gridGap}px` }}>
        {items.map((item, index) => {
          return (
            <div
              key={index}
              className="flex items-center w-full flex-col md:flex-row"
            >
              <div
                className="flex-shrink-0 w-28 h-14 md:w-40 md:h-16 flex items-center justify-center relative"
                style={{
                  ...getBgStyle(pyramidColor),
                  clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)",
                  marginBottom: isMobile ? `${pad}px` : undefined,
                }}
              >
                <div className="flex items-center justify-center transform skew-x-[-10deg]">
                  {markerType === "icon" ? (
                    <DynamicIcon
                      name={item.icon || "Check"}
                      size={isMobile ? 20 : 28}
                      color={numberColor}
                    />
                  ) : markerType === "number" ? (
                    <EditableText
                      tagName="span"
                      className="text-xl md:text-3xl font-bold"
                      style={getGradientTextStyle(numberColor)}
                      html={item.number || String(index + 1)}
                      editable={!isPreview}
                      onBlur={(e) =>
                        updateItem(index, "number", e.currentTarget.innerHTML)
                      }
                    />
                  ) : null}
                </div>
              </div>

              <div
                className="flex-1 w-full flex items-center"
                style={{ paddingLeft: `${pad}px`, paddingRight: `${pad}px` }}
              >
                <EditableText
                  tagName="div"
                  className="font-medium leading-snug"
                  style={{
                    ...getGradientTextStyle(textColor),
                    fontSize: `${fz}px`,
                  }}
                  html={item.text}
                  editable={!isPreview}
                  onBlur={(e) =>
                    updateItem(index, "text", e.currentTarget.innerHTML)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGridRounded = () => {
    return (
      <div
        className={`grid w-full ${
          isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"
        }`}
        style={{ gap: `${gridGap}px` }}
      >
        {items.map((item, index) => {
          return (
            <div key={index} className="flex flex-col items-center text-center">
              <div
                className="w-full relative flex items-center justify-center"
                style={{
                  ...getBgStyle(pyramidColor),
                  borderRadius: "9999px",
                  padding: `${pad}px`,
                  marginBottom: `${gridGap}px`,
                }}
              >
                {markerType === "icon" ? (
                  <DynamicIcon
                    name={item.icon || "Check"}
                    size={isMobile ? 24 : 28}
                    color={numberColor}
                  />
                ) : markerType === "number" ? (
                  <EditableText
                    tagName="span"
                    className="font-bold"
                    style={{
                      ...getGradientTextStyle(numberColor),
                      fontSize: `${fz}px`,
                    }}
                    html={item.number || String(index + 1)}
                    editable={!isPreview}
                    onBlur={(e) =>
                      updateItem(index, "number", e.currentTarget.innerHTML)
                    }
                  />
                ) : null}
              </div>

              <EditableText
                tagName="div"
                className="font-medium leading-snug px-2"
                style={{
                  ...getGradientTextStyle(textColor),
                  fontSize: `${fz}px`,
                }}
                html={item.text}
                editable={!isPreview}
                onBlur={(e) =>
                  updateItem(index, "text", e.currentTarget.innerHTML)
                }
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderGridSkewed = () => {
    return (
      <div
        className={`grid w-full ${
          isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"
        }`}
        style={{ gap: `${gridGap}px` }}
      >
        {items.map((item, index) => {
          return (
            <div key={index} className="flex flex-col items-center text-center">
              <div
                className="w-full relative flex items-center justify-center"
                style={{
                  ...getBgStyle(pyramidColor),
                  clipPath: "polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)",
                  padding: `${pad}px`,
                  marginBottom: `${gridGap}px`,
                }}
              >
                {markerType === "icon" ? (
                  <DynamicIcon
                    name={item.icon || "Check"}
                    size={isMobile ? 24 : 28}
                    color={numberColor}
                  />
                ) : markerType === "number" ? (
                  <EditableText
                    tagName="span"
                    className="font-bold"
                    style={{
                      ...getGradientTextStyle(numberColor),
                      fontSize: `${fz}px`,
                    }}
                    html={item.number || String(index + 1)}
                    editable={!isPreview}
                    onBlur={(e) =>
                      updateItem(index, "number", e.currentTarget.innerHTML)
                    }
                  />
                ) : null}
              </div>

              <EditableText
                tagName="div"
                className="font-medium leading-snug px-2"
                style={{
                  ...getGradientTextStyle(textColor),
                  fontSize: `${fz}px`,
                }}
                html={item.text}
                editable={!isPreview}
                onBlur={(e) =>
                  updateItem(index, "text", e.currentTarget.innerHTML)
                }
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={element.style} className="w-full">
      {layout === "vertical-boxes" && renderVerticalBoxes()}
      {layout === "vertical-left" && renderVerticalLeft()}
      {layout === "list-skewed" && renderListSkewed()}
      {layout === "grid-rounded" && renderGridRounded()}
      {layout === "grid-skewed" && renderGridSkewed()}

      {![
        "vertical-boxes",
        "vertical-left",
        "list-skewed",
        "grid-rounded",
        "grid-skewed",
      ].includes(layout) && renderVerticalBoxes()}
    </div>
  );
};

export const SequenceDef = {
  name: "Sequence",
  icon: <Icons.ListOrdered className="w-4 h-4" />,
  category: "Content",
  component: SequenceComponent,
  defaultData: {
    layout: "vertical-boxes",
    items: [
      {
        text: "পাকস্থলীর কার্য ক্ষমতা যায়।",
        icon: "Users",
        number: "1",
      },
      { text: "শরীরে রোগজীবাণু প্রবেশের সক্ষমতা বেড়ে যাবে।", number: "2" },
      { text: "পাকস্থলীর ক্যানসারও হতে পারে।", number: "3" },
      { text: "পাকস্থলীর পিএইচ পরিবর্তিত হয়ে যায়।", number: "4" },
      { text: "রক্তশূন্যতা দেখা দিতে পারে।", number: "5" },
    ],
    pyramidColor: "var(--color-input-background)",
    textColor: "var(--color-foreground)",
    numberColor: "var(--color-primary)",
    lineColor: "var(--color-border)",
    gap: 24,
    rowPadding: 16,
    textSize: 16,
    mobileRowPadding: 12,
    mobileTextSize: 14,
    mobileGap: 16,
  },
  settings: {
    layout: {
      type: "select",
      label: "Layout Style",
      options: [
        { label: "Vertical Boxes", value: "vertical-boxes" },
        { label: "Vertical Left List", value: "vertical-left" },
        { label: "List Skewed", value: "list-skewed" },
        { label: "Grid Rounded", value: "grid-rounded" },
        { label: "Grid Skewed", value: "grid-skewed" },
      ],
      default: "vertical-boxes",
    },
    markerType: {
      type: "select",
      label: "Marker Type",
      options: [
        { label: "Number", value: "number" },
        { label: "Icon", value: "icon" },
        { label: "Dot Only", value: "dot" },
      ],
      default: "number",
    },
    items: {
      type: "array_object",
      label: "Steps",
      itemSchema: {
        text: { type: "text", label: "Text", default: "Step description" },
        subtext: { type: "text", label: "Subtext", default: "" },
        number: { type: "text", label: "Number/Label", default: "1" },
        icon: { type: "icon", label: "Icon (Overrides Number)", default: "" },
      },
      defaultItem: { text: "New Step", number: "1" },
    },
    pyramidColor: {
      type: "color",
      label: "Base/Box Color",
      default: "var(--color-input-background)",
    },
    textColor: {
      type: "color",
      label: "Text Color",
      default: "var(--color-foreground)",
    },
    numberColor: {
      type: "color",
      label: "Number/Icon Color",
      default: "var(--color-primary)",
    },
    lineColor: {
      type: "color",
      label: "Line Color",
      default: "var(--color-border)",
    },
    gap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 64,
      default: 24,
    },
    mobileGap: {
      type: "number_slider",
      label: "Gap (Mobile)",
      min: 0,
      max: 40,
      default: 16,
    },
    rowPadding: {
      type: "number_slider",
      label: "Row Padding",
      min: 0,
      max: 40,
      default: 16,
    },
    textSize: {
      type: "number_slider",
      label: "Text Size",
      min: 10,
      max: 28,
      default: 16,
    },
    mobileRowPadding: {
      type: "number_slider",
      label: "Row Padding (Mobile)",
      min: 0,
      max: 32,
      default: 12,
    },
    mobileTextSize: {
      type: "number_slider",
      label: "Text Size (Mobile)",
      min: 10,
      max: 24,
      default: 14,
    },
  },
};
