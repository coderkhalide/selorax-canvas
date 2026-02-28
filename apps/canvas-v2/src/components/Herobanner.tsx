"use client";

import React from "react";
import { imageGetUrl } from "@/utils/utils";

interface HeroBannerProps {
  backgroundImage: string;
  badgeText?: string;
  heading: React.ReactNode;
  description?: string;
}

export default function HeroBanner({
  backgroundImage,
  badgeText,
  heading,
  description,
}: HeroBannerProps) {
  const bgSrc = imageGetUrl(backgroundImage);

  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${bgSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {badgeText && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            {badgeText}
          </span>
        )}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
          {heading}
        </h1>
        {description && (
          <p className="text-base sm:text-lg text-white/80 max-w-2xl">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
