import React from "react";

const Dot = ({ color }: { color: string }) => (
  <div
    className="w-3 h-3 rounded-full shadow"
    style={{ backgroundColor: color }}
  />
);

const Pill = () => <div className="h-2 rounded-full bg-gray-200" />;

const HorizontalCardsPreview = () => (
  <div className="w-full h-full p-2 bg-white rounded-md">
    <div className="flex gap-2 mb-2 justify-center">
      {Array.from({ length: 3 }).map((_, i) => (
        <Dot key={i} color={"var(--color-primary)"} />
      ))}
    </div>
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-md p-1">
          <div className="space-y-2">
            <Pill />
            <Pill />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const HorizontalAlternatingPreview = () => (
  <div className="w-full h-full p-2 bg-white rounded-md">
    <div className="grid grid-cols-2 gap-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-md p-1">
          <div className="space-y-2">
            <Pill />
            <Pill />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const VerticalLeftPreview = () => (
  <div className="w-full h-full p-2 bg-white rounded-md">
    <div className="grid grid-cols-2 gap-3 items-center">
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
        <div
          className="h-6 w-1"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
      </div>
      <div className="space-y-2">
        <Pill />
        <Pill />
      </div>
    </div>
  </div>
);

const VerticalRightPreview = () => (
  <div className="w-full h-full p-2 bg-white rounded-md">
    <div className="grid grid-cols-2 gap-3 items-center">
      <div className="space-y-2">
        <Pill />
        <Pill />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <div
          className="h-6 w-1"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
      </div>
    </div>
  </div>
);

// Circle Layout Previews
const ClassicCirclePreview = () => (
  <div className="w-full h-full p-4 bg-white rounded-md flex items-center justify-center">
    <div className="relative w-24 h-24">
      <div
        className="absolute inset-0 rounded-full border-2"
        style={{
          borderColor: "var(--color-primary)",
          backgroundColor: "var(--color-input-background)",
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300" />
        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-300" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full bg-gray-300" />
      </div>
    </div>
  </div>
);

const HalfArcPreview = () => (
  <div className="w-full h-full p-4 bg-white rounded-md flex items-center justify-center">
    <div className="w-full h-20 relative">
      <svg className="w-full h-full" viewBox="0 0 100 50">
        <path
          d="M 10 40 Q 50 10, 90 40"
          stroke="var(--color-primary)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="4,2"
        />
      </svg>
      <div
        className="absolute top-8 left-2 w-3 h-3 rounded-full"
        style={{ backgroundColor: "var(--color-primary)" }}
      />
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
        style={{ backgroundColor: "var(--color-primary)" }}
      />
      <div
        className="absolute top-8 right-2 w-3 h-3 rounded-full"
        style={{ backgroundColor: "var(--color-primary)" }}
      />
    </div>
  </div>
);

const CardsCenterPreview = () => (
  <div className="w-full h-full p-2 bg-white rounded-md flex items-center gap-1">
    <div className="flex-1 space-y-1">
      <div
        className="h-3 rounded border-l-2"
        style={{
          backgroundColor: "var(--color-input-background)",
          borderLeftColor: "var(--color-primary)",
        }}
      />
      <div
        className="h-3 rounded border-l-2"
        style={{
          backgroundColor: "var(--color-input-background)",
          borderLeftColor: "var(--color-primary)",
        }}
      />
    </div>
    <div
      className="w-6 h-6 rounded-full flex-shrink-0"
      style={{ backgroundColor: "var(--color-primary)" }}
    />
    <div className="flex-1 space-y-1">
      <div
        className="h-3 rounded border-r-2"
        style={{
          backgroundColor: "var(--color-input-background)",
          borderRightColor: "var(--color-primary)",
        }}
      />
      <div
        className="h-3 rounded border-r-2"
        style={{
          backgroundColor: "var(--color-input-background)",
          borderRightColor: "var(--color-primary)",
        }}
      />
    </div>
  </div>
);

const StaircasePreview = () => (
  <div className="w-full h-full p-2 bg-white rounded-md">
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <div
          className="w-4 h-4 rounded flex-shrink-0"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
        <div
          className="h-2.5 flex-1 rounded"
          style={{ backgroundColor: "var(--color-input-background)" }}
        />
      </div>
      <div className="flex items-center gap-1 ml-4">
        <div
          className="w-4 h-4 rounded flex-shrink-0"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
        <div
          className="h-2.5 flex-1 rounded"
          style={{ backgroundColor: "var(--color-input-background)" }}
        />
      </div>
      <div className="flex items-center gap-1 ml-8">
        <div
          className="w-4 h-4 rounded flex-shrink-0"
          style={{ backgroundColor: "var(--color-primary)" }}
        />
        <div
          className="h-2.5 flex-1 rounded"
          style={{ backgroundColor: "var(--color-input-background)" }}
        />
      </div>
    </div>
  </div>
);

const HoneycombPreview = () => (
  <div className="w-full h-full p-2 bg-white rounded-md flex items-center justify-center">
    <div className="grid grid-cols-3 gap-1">
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="w-4 h-4">
          <polygon
            points="10 1 18 5 18 15 10 19 2 15 2 5"
            fill="var(--color-primary)"
            stroke="#ffffff"
            strokeWidth="1"
          />
        </svg>
      ))}
    </div>
  </div>
);

export const getLayoutPreview = (
  componentType: string,
  layoutId: string
): React.ReactNode | undefined => {
  if (componentType === "circle") {
    switch (layoutId) {
      case "circle-classic":
        return <ClassicCirclePreview />;
      case "circle-half-arc":
        return <HalfArcPreview />;
      case "circle-cards-center":
        return <CardsCenterPreview />;
      case "circle-staircase":
        return <StaircasePreview />;
      case "circle-honeycomb":
        return <HoneycombPreview />;
      default:
        return undefined;
    }
  }

  return undefined;
};

export const getDefaultPreview = (): React.ReactNode => (
  <div className="w-full h-full p-2 bg-white rounded-md">
    <div className="grid grid-cols-2 gap-1">
      <div className="bg-gray-100 rounded-md p-1 space-y-2">
        <div className="h-2 rounded-full bg-gray-200" />
        <div className="h-2 rounded-full bg-gray-200" />
      </div>
      <div className="bg-gray-100 rounded-md p-1 space-y-2">
        <div className="h-2 rounded-full bg-gray-200" />
        <div className="h-2 rounded-full bg-gray-200" />
      </div>
    </div>
  </div>
);

export const ScaledPreview: React.FC<{
  scale?: number;
  children: React.ReactNode;
}> = ({ scale = 0.25, children }) => {
  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center bg-gray-50">
      <div
        style={{
          width: "1200px", // Fixed width to simulate desktop view
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          pointerEvents: "none",
          willChange: "transform",
          // Ensure background is white or transparent as needed, mostly components have their own bg
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const getScaledLivePreview = (
  Component: any,
  element: any,
  mergedData: any,
  scale = 0.5
) => (
  <ScaledPreview scale={scale}>
    <Component element={{ ...element, data: mergedData }} isPreview />
  </ScaledPreview>
);
