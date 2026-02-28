import { useState } from "react";
import { EditableText } from "./EditableText";
import * as Icons from "lucide-react";
import { getGradientTextStyle } from "./styleUtils";

const AccordionComponent = ({ element, onUpdate, isPreview }) => {
  const {
    items = [],
    allowMultiple = true,
    titleColor = "var(--color-foreground-heading)",
    contentColor = "var(--color-foreground)",
    borderColor = "var(--color-border, #e5e7eb)",
    backgroundColor = "var(--color-background, #ffffff)",
    activeBackgroundColor = "var(--color-surface, #f9fafb)",
    hoverBackgroundColor = "var(--color-surface-hover, #f3f4f6)",
    borderRadius = 12,
    gap = 12,
    animationDuration = 300,
  } = element.data || {};

  const [openItems, setOpenItems] = useState([0]);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const toggleItem = (index) => {
    if (allowMultiple) {
      if (openItems.includes(index)) {
        setOpenItems(openItems.filter((i) => i !== index));
      } else {
        setOpenItems([...openItems, index]);
      }
    } else {
      if (openItems.includes(index)) {
        setOpenItems([]);
      } else {
        setOpenItems([index]);
      }
    }
  };

  return (
    <div
      style={{
        ...element.style,
        display: "flex",
        flexDirection: "column",
        gap: `${gap}px`,
      }}
      className="w-full"
    >
      {items.map((item, index) => {
        const isOpen = openItems.includes(index);
        const isHovered = hoveredIndex === index;

        // Determine background color based on state
        let bgColor = backgroundColor;
        if (isOpen) {
          bgColor = activeBackgroundColor;
        } else if (isHovered) {
          bgColor = hoverBackgroundColor;
        }

        return (
          <div
            key={index}
            className="border overflow-hidden"
            style={{
              borderColor,
              borderRadius: `${borderRadius}px`,
              backgroundColor: bgColor,
              transition: `all ${animationDuration}ms ease`,
              cursor: "pointer",
            }}
            onClick={() => toggleItem(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4"
              style={{ userSelect: "none" }}
            >
              <EditableText
                tagName="h3"
                className="font-semibold text-lg flex-1 mr-4"
                style={getGradientTextStyle(titleColor)}
                html={item.title}
                editable={!isPreview}
                onBlur={(e) => {
                  if (onUpdate) {
                    const newItems = [...items];
                    newItems[index] = { ...newItems[index], title: e.currentTarget.innerHTML };
                    onUpdate(element.id, { data: { ...element.data, items: newItems } });
                  }
                }}
              />
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  color: isOpen ? "var(--color-primary, #3b82f6)" : "var(--color-foreground-muted, #6b7280)",
                  transition: `transform ${animationDuration}ms ease, color ${animationDuration}ms ease`,
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <Icons.ChevronDown size={20} strokeWidth={2} />
              </div>
            </div>

            {/* Content with CSS Grid Animation */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: isOpen ? "1fr" : "0fr",
                transition: `grid-template-rows ${animationDuration}ms ease`,
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div
                  className="px-4 pb-4 border-t"
                  style={{
                    borderColor,
                    borderTopStyle: "dashed",
                    opacity: isOpen ? 1 : 0,
                    transition: `opacity ${animationDuration}ms ease`,
                  }}
                >
                  <EditableText
                    tagName="div"
                    className="pt-4 text-base leading-relaxed"
                    style={getGradientTextStyle(contentColor)}
                    html={item.content}
                    editable={!isPreview}
                    onBlur={(e) => {
                      if (onUpdate) {
                        const newItems = [...items];
                        newItems[index] = { ...newItems[index], content: e.currentTarget.innerHTML };
                        onUpdate(element.id, { data: { ...element.data, items: newItems } });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const CustomAccordianDef = {
  name: "Accordion",
  icon: <Icons.ListCollapse className="w-4 h-4" />,
  category: "Content",
  component: AccordionComponent,
  defaultData: {
    items: [
      {
        title: "What is Flowbite?",
        content:
          "Flowbite is an open-source library of interactive components built on top of Tailwind CSS including buttons, dropdowns, modals, navbars, and more.",
      },
      {
        title: "Is there a Figma file available?",
        content:
          "Flowbite is first conceived and designed using the Figma software so everything you see in the library has a design equivalent in our Figma file.",
      },
      {
        title: "What are the differences between Flowbite and Tailwind UI?",
        content:
          "The main difference is that the core components from Flowbite are open source under the MIT license, whereas Tailwind UI is a paid product.",
      },
    ],
    allowMultiple: true,
    titleColor: "var(--color-foreground-heading)",
    contentColor: "var(--color-foreground)",
    borderColor: "var(--color-border, #e5e7eb)",
    backgroundColor: "var(--color-background, #ffffff)",
    activeBackgroundColor: "var(--color-surface, #f9fafb)",
    hoverBackgroundColor: "var(--color-surface-hover, #f3f4f6)",
    borderRadius: 12,
    gap: 12,
    animationDuration: 300,
  },
  settings: {
    items: {
      type: "array_object",
      label: "Accordion Items",
      itemSchema: {
        title: { type: "text", label: "Title", default: "Question" },
        content: { type: "textarea", label: "Content", default: "Answer" },
      },
      defaultItem: {
        title: "New Question",
        content: "New Answer",
      },
    },
    allowMultiple: {
      type: "boolean",
      label: "Allow Multiple Open",
      default: true,
    },
    gap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 40,
      default: 12,
    },
    borderRadius: {
      type: "number_slider",
      label: "Border Radius",
      min: 0,
      max: 40,
      default: 12,
    },
    animationDuration: {
      type: "number_slider",
      label: "Animation Speed (ms)",
      min: 100,
      max: 600,
      default: 300,
    },
    titleColor: {
      type: "color",
      label: "Title Color",
      default: "var(--color-foreground-heading)",
    },
    contentColor: {
      type: "color",
      label: "Content Color",
      default: "var(--color-foreground)",
    },
    borderColor: {
      type: "color",
      label: "Border Color",
      default: "var(--color-border, #e5e7eb)",
    },
    backgroundColor: {
      type: "color",
      label: "Background Color",
      default: "var(--color-background, #ffffff)",
    },
    activeBackgroundColor: {
      type: "color",
      label: "Active Background",
      default: "var(--color-surface, #f9fafb)",
    },
    hoverBackgroundColor: {
      type: "color",
      label: "Hover Background",
      default: "var(--color-surface-hover, #f3f4f6)",
    },
  },
};
