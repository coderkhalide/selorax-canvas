import React, { useRef, useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { getGradientTextStyle } from "./styleUtils";

/**
 * 4. CountdownBlock
 */
const CountdownComponent = ({ element, onUpdate, isPreview }) => {
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
    mobileGap,
  } = element.data || {};
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const effectiveGap = isMobile ? mobileGap ?? gap ?? 16 : gap ?? 16;
  const effectiveDigitSize = isMobile
    ? mobileDigitSize ?? digitSize ?? 32
    : digitSize ?? 32;
  const effectiveLabelSize = isMobile
    ? mobileLabelSize ?? labelSize ?? 12
    : labelSize ?? 12;
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Fix stale closure issue
  const elementRef = useRef(element);
  elementRef.current = element;

  useEffect(() => {
    // Calculate target date based on selected duration
    const getTargetDate = () => {
      const now = new Date();
      const durationMap = {
        "12h": 12 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "2d": 2 * 24 * 60 * 60 * 1000,
        "3d": 3 * 24 * 60 * 60 * 1000,
        "5d": 5 * 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
      };

      const ms = durationMap[duration || "24h"] || 86400000;
      return new Date(now.getTime() + ms).getTime();
    };

    // NOTE: In a real funnel, you'd want this to be sticky per user (e.g. stored in localStorage).
    // For this builder preview, we'll just show the full duration to demonstrate the visual.
    // OR we can just calculate it once on mount.

    const targetTime = getTargetDate();

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      // For the visual builder, let's just show the static duration decrementing
      // to avoid confusion where it jumps around.
      // But to make it "live", we need a fixed end point.
      // Let's use the derived targetTime.

      const difference = targetTime - now;

      let timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

      if (difference > 0) {
        timeLeft = {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }
      return timeLeft;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [duration]); // Re-run when duration setting changes

  const TimeUnit = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center justify-center font-bold rounded-lg shadow-sm"
        style={{
          background: digitBgColor || "#f3f4f6",
          ...getGradientTextStyle(digitColor || "#1f2937"),
          fontSize: `${effectiveDigitSize}px`,
          width: `${effectiveDigitSize * 2.5}px`,
          height: `${effectiveDigitSize * 2.5}px`,
          marginBottom: "0.5rem",
        }}
      >
        {String(value).padStart(2, "0")}
      </div>
      <div
        className="font-medium uppercase tracking-wider"
        style={{
          ...getGradientTextStyle(labelColor || "#6b7280"),
          fontSize: `${effectiveLabelSize}px`,
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div style={element.style} className={`w-full flex flex-col items-center ${element.className || ""}`}>
      <div
        className="flex flex-wrap justify-center"
        style={{ gap: `${effectiveGap}px` }}
      >
        <TimeUnit value={timeLeft.days} label="Days" />
        <TimeUnit value={timeLeft.hours} label="Hours" />
        <TimeUnit value={timeLeft.minutes} label="Minutes" />
        <TimeUnit value={timeLeft.seconds} label="Seconds" />
      </div>
    </div>
  );
};

export const CountdownDef = {
  name: "Countdown Timer",
  icon: <Timer className="w-4 h-4" />,
  category: "Conversion",
  component: CountdownComponent,
  defaultData: {
    duration: "24h",
    digitColor: "var(--color-primary-button-text)",
    labelColor: "var(--color-foreground)",
    digitBgColor: "var(--color-primary-button-background)",
    gap: 20,
    digitSize: 36,
    labelSize: 12,
    mobileDigitSize: 28,
    mobileLabelSize: 12,
    mobileGap: 12,
  },
  settings: {
    duration: {
      type: "select",
      label: "Duration",
      options: [
        { label: "12 Hours", value: "12h" },
        { label: "24 Hours", value: "24h" },
        { label: "2 Days", value: "2d" },
        { label: "3 Days", value: "3d" },
        { label: "5 Days", value: "5d" },
        { label: "7 Days", value: "7d" },
      ],
      default: "24h",
    },
    digitColor: {
      type: "color",
      label: "Digit Color",
      default: "var(--color-primary-button-text)",
    },
    digitBgColor: {
      type: "color",
      label: "Digit Background",
      default: "var(--color-primary-button-background)",
    },
    labelColor: { type: "color", label: "Label Color", default: "#6b7280" },
    digitSize: {
      type: "number_slider",
      label: "Digit Size",
      min: 16,
      max: 96,
      default: 36,
    },
    labelSize: {
      type: "number_slider",
      label: "Label Size",
      min: 10,
      max: 24,
      default: 12,
    },
    mobileDigitSize: {
      type: "number_slider",
      label: "Mobile Digit Size",
      min: 16,
      max: 96,
      default: 28,
    },
    mobileLabelSize: {
      type: "number_slider",
      label: "Mobile Label Size",
      min: 10,
      max: 24,
      default: 12,
    },
    gap: { type: "number_slider", label: "Gap", min: 0, max: 60, default: 20 },
    mobileGap: {
      type: "number_slider",
      label: "Mobile Gap",
      min: 0,
      max: 60,
      default: 12,
    },
  },
};
