"use client";

import React from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { imageGetUrl } from "@/utils/utils";

interface LightboxImage {
  src: string;
  title?: string;
  category?: string;
  year?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  currentIndex,
  isOpen,
  onClose,
  onPrevious,
  onNext,
}) => {
  if (!isOpen || images.length === 0) return null;

  const current = images[currentIndex] || images[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4 sm:px-8"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 h-9 w-9 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
      >
        <X className="w-5 h-5" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrevious();
        }}
        className="hidden sm:flex absolute left-4 sm:left-6 h-10 w-10 rounded-full bg-black/60 items-center justify-center text-white hover:bg-black/80"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div
        className="relative max-w-5xl w-full max-h-[90vh] bg-black/40 rounded-2xl overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full bg-black flex items-center justify-center">
          <img
            src={imageGetUrl(current.src)}
            alt={current.title || "Gallery image"}
            className="max-h-[75vh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-black/80 text-white text-xs sm:text-sm">
          <div>
            {current.title && (
              <div className="font-medium truncate">{current.title}</div>
            )}
            {(current.category || current.year) && (
              <div className="text-white/70 text-[11px] sm:text-xs">
                {current.category}
                {current.category && current.year && " • "}
                {current.year}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/70 text-[11px] sm:text-xs">
              {currentIndex + 1} / {images.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onPrevious}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onNext}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

