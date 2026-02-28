import React, { useState, useMemo, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import * as Icons from "lucide-react";
import { Search, X } from "lucide-react";

// Error Boundary for individual icons
class IconErrorBoundary extends React.Component<
  { children: React.ReactNode; iconName: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; iconName: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error(`Error rendering icon ${this.props.iconName}:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center text-[10px] text-red-500">
          !
        </div>
      );
    }
    return this.props.children;
  }
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  hideName?: boolean;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  hideName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uniqueId = useId();

  // Setup portal container
  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  // Calculate popup position
  const updatePopupPosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const screenH = window.innerHeight;
      const screenW = window.innerWidth;
      const popupH = 420;
      const popupW = 340;
      const spaceBelow = screenH - rect.bottom;

      let top = rect.bottom + 5;
      if (spaceBelow < popupH && rect.top > popupH) {
        top = rect.top - popupH - 5;
      }
      // Ensure it doesn't go off screen
      if (top < 10) top = 10;
      if (top + popupH > screenH - 10) top = screenH - popupH - 10;

      let left = rect.right - popupW;
      if (left < 10) left = 10;
      if (left + popupW > screenW - 10) left = screenW - popupW - 10;

      setPopupPosition({ top, left });
    }
  };

  // Close popup on click outside - using capture phase
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is inside wrapper or popup
      if (wrapperRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;

      setIsOpen(false);
    };

    // Use capture phase and delay slightly
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isOpen]);

  // Focus input when popup opens and reset search when closes
  useEffect(() => {
    if (isOpen) {
      updatePopupPosition();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Update position on resize/scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => updatePopupPosition();
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [isOpen]);

  const openPopup = () => {
    updatePopupPosition();
    setIsOpen(true);
  };

  const closePopup = () => {
    setIsOpen(false);
  };

  const toggleOpen = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isOpen) {
      closePopup();
    } else {
      openPopup();
    }
  };

  const iconList = useMemo(() => {
    const allKeys = Object.keys(Icons);

    return allKeys.filter((key) => {
      if (
        key === "createLucideIcon" ||
        key === "default" ||
        key === "icons" ||
        key === "createElement" ||
        key === "IconNode" ||
        key.startsWith("__")
      )
        return false;

      if (!isNaN(Number(key))) return false;
      if (!/^[A-Z]/.test(key)) return false;
      if (key.endsWith("Icon") && allKeys.includes(key.replace(/Icon$/, ""))) {
        return false;
      }

      const maybeIcon = (Icons as any)[key];
      if (typeof maybeIcon !== "function" && typeof maybeIcon !== "object")
        return false;
      if (
        typeof maybeIcon === "object" &&
        maybeIcon !== null &&
        !("$$typeof" in maybeIcon)
      )
        return false;

      return true;
    }).sort();
  }, []);

  const filteredIcons = useMemo(() => {
    try {
      const list = Array.isArray(iconList) ? iconList : [];
      if (!search) {
        return list.slice(0, 200);
      }
      const searchLower = search.toLowerCase();
      return list
        .filter((name) => name.toLowerCase().includes(searchLower))
        .slice(0, 500);
    } catch (e) {
      console.error("Error filtering icons:", e);
      return [];
    }
  }, [search, iconList]);

  const handleSelectIcon = (iconName: string) => {
    onChange(iconName);
    closePopup();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && filteredIcons.length > 0) {
      e.preventDefault();
      handleSelectIcon(filteredIcons[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
    }
  };

  const SelectedIcon = (Icons as any)[value] || Icons.HelpCircle;

  // Render popup using Portal to escape scrollable containers
  const renderPopup = () => {
    if (!isOpen || !portalContainer) return null;

    const popupContent = (
      <div
        ref={popupRef}
        id={`icon-picker-popup-${uniqueId}`}
        style={{
          position: "fixed",
          top: popupPosition.top,
          left: popupPosition.left,
          zIndex: 99999,
        }}
        className="bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col max-h-[420px] w-[340px]"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with search */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none focus:outline-none p-0 text-sm text-gray-900 placeholder:text-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch("");
                  inputRef.current?.focus();
                }}
                className="ml-1 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Icon grid */}
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-7 gap-1 content-start min-h-[260px] max-h-[300px]">
          {filteredIcons.length > 0 ? (
            filteredIcons.map((iconName) => {
              const Icon = (Icons as any)[iconName];
              if (!Icon) return null;
              return (
                <button
                  type="button"
                  key={iconName}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectIcon(iconName);
                  }}
                  className={`p-2 rounded-lg hover:bg-blue-50 flex items-center justify-center aspect-square transition-all ${
                    value === iconName
                      ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
                      : "text-gray-600 hover:text-blue-600"
                  }`}
                  title={iconName}
                >
                  <IconErrorBoundary iconName={iconName}>
                    <Icon className="w-5 h-5" />
                  </IconErrorBoundary>
                </button>
              );
            })
          ) : (
            <div className="col-span-7 text-center py-12 text-gray-400 text-sm">
              No icons found for "{search}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2.5 border-t border-gray-100 text-xs text-gray-500 text-center bg-gray-50/80 rounded-b-xl">
          {search ? (
            <>
              <span className="font-medium">{filteredIcons.length}</span> matching
              {filteredIcons.length >= 500 && " (first 500)"}
            </>
          ) : (
            <>
              <span className="font-medium">{filteredIcons.length}</span> of {iconList.length} icons
              {filteredIcons.length < iconList.length && " • Type to search all"}
            </>
          )}
        </div>
      </div>
    );

    // Use Portal to render outside scrollable containers
    return createPortal(popupContent, portalContainer);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {hideName ? (
        <div className="flex items-center gap-2">
          <div
            onClick={toggleOpen}
            className={`flex-1 flex items-center justify-center h-[38px] bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-all ${
              isOpen ? "border-blue-500 ring-2 ring-blue-100" : ""
            }`}
          >
            <SelectedIcon className="w-5 h-5 text-gray-600" />
          </div>

          <div className="flex bg-white rounded-lg border border-gray-200 p-0.5 shrink-0 h-[38px] items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                openPopup();
              }}
              className={`px-3 h-full rounded-md text-xs transition-all flex items-center ${
                isOpen
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              Show
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                closePopup();
              }}
              className={`px-3 h-full rounded-md text-xs transition-all flex items-center ${
                !isOpen
                  ? "bg-gray-100 text-gray-700 font-medium"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              Hide
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={toggleOpen}
          className={`flex items-center gap-2 w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 cursor-pointer hover:border-blue-400 transition-all ${
            isOpen ? "border-blue-500 ring-2 ring-blue-100" : ""
          }`}
        >
          <SelectedIcon className="w-5 h-5 text-gray-600" />
          <span className="flex-1 truncate">{value}</span>
        </div>
      )}

      {renderPopup()}
    </div>
  );
};
