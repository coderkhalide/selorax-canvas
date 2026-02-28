import React2 from "react";

import React, { useRef } from "react";

var getGradientTextStyle = (color) => {
  if (color?.includes("gradient")) {
    return {
      backgroundImage: color,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent"
    };
  }
  return { color };
};

import { jsx, jsxs } from "react/jsx-runtime";
var CountdownComponent = ({ element, onUpdate, isPreview }) => {
  const {
    duration,
    digitColor,
    labelColor,
    digitBgColor,
    gap,
    labelSize,
    digitSize,
    mobileDigitSize,
    mobileLabelSize,
    mobileGap
  } = element.data || {};
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const effectiveGap = isMobile ? mobileGap ?? gap ?? 16 : gap ?? 16;
  const effectiveDigitSize = isMobile ? mobileDigitSize ?? digitSize ?? 32 : digitSize ?? 32;
  const effectiveLabelSize = isMobile ? mobileLabelSize ?? labelSize ?? 12 : labelSize ?? 12;
  const [timeLeft, setTimeLeft] = React.useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const elementRef = useRef(element);
  elementRef.current = element;
  React.useEffect(() => {
    const getTargetDate = () => {
      const now = /* @__PURE__ */ new Date();
      const durationMap = {
        "12h": 12 * 60 * 60 * 1e3,
        "24h": 24 * 60 * 60 * 1e3,
        "2d": 2 * 24 * 60 * 60 * 1e3,
        "3d": 3 * 24 * 60 * 60 * 1e3,
        "5d": 5 * 24 * 60 * 60 * 1e3,
        "7d": 7 * 24 * 60 * 60 * 1e3
      };
      const ms = durationMap[duration || "24h"] || 864e5;
      return new Date(now.getTime() + ms).getTime();
    };
    const targetTime = getTargetDate();
    const calculateTimeLeft = () => {
      const now = (/* @__PURE__ */ new Date()).getTime();
      const difference = targetTime - now;
      let timeLeft2 = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      if (difference > 0) {
        timeLeft2 = {
          days: Math.floor(difference / (1e3 * 60 * 60 * 24)),
          hours: Math.floor(difference / (1e3 * 60 * 60) % 24),
          minutes: Math.floor(difference / 1e3 / 60 % 60),
          seconds: Math.floor(difference / 1e3 % 60)
        };
      }
      return timeLeft2;
    };
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1e3);
    return () => clearInterval(timer);
  }, [duration]);
  const TimeUnit = ({ value, label }) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "flex items-center justify-center font-bold rounded-lg shadow-sm",
        style: {
          background: digitBgColor || "#f3f4f6",
          ...getGradientTextStyle(digitColor || "#1f2937"),
          fontSize: `${effectiveDigitSize}px`,
          width: `${effectiveDigitSize * 2.5}px`,
          height: `${effectiveDigitSize * 2.5}px`,
          marginBottom: "0.5rem"
        },
        children: String(value).padStart(2, "0")
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "font-medium uppercase tracking-wider",
        style: {
          ...getGradientTextStyle(labelColor || "#6b7280"),
          fontSize: `${effectiveLabelSize}px`
        },
        children: label
      }
    )
  ] });
  return /* @__PURE__ */ jsx("div", { style: element.style, className: `w-full flex flex-col items-center ${element.className || ""}`, children: /* @__PURE__ */ jsxs(
    "div",
    {
      className: "flex flex-wrap justify-center",
      style: { gap: `${effectiveGap}px` },
      children: [
        /* @__PURE__ */ jsx(TimeUnit, { value: timeLeft.days, label: "Days" }),
        /* @__PURE__ */ jsx(TimeUnit, { value: timeLeft.hours, label: "Hours" }),
        /* @__PURE__ */ jsx(TimeUnit, { value: timeLeft.minutes, label: "Minutes" }),
        /* @__PURE__ */ jsx(TimeUnit, { value: timeLeft.seconds, label: "Seconds" })
      ]
    }
  ) });
};

function countdownRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "countdown",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React2.createElement(CountdownComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  countdownRender as default
};
