import React, { useState, useEffect } from "react";
import { FunnelElement, DropPosition, DND_RULES } from "../types";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Copy,
  Trash2,
  Loader2,
} from "lucide-react";
import { useFunnel } from "../context/FunnelContext";
import { useAIActivity } from "../context/AIActivityContext";

const LayerItem: React.FC<{
  element: FunnelElement;
  depth: number;
  parentType: string;
}> = ({ element, depth, parentType }) => {
  const {
    selectedElement,
    setSelectedId,
    updateElement,
    moveElement,
    deleteElement,
    duplicateElement,
    draggingType,
    setDraggingType,
  } = useFunnel();

  const { isElementBeingWorkedOn, getActivityForElement } = useAIActivity();

  const [isExpanded, setIsExpanded] = useState(true);
  const [dropState, setDropState] = useState<DropPosition | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(element.name);

  // Check if this element is being updated by AI
  const isAIWorking = isElementBeingWorkedOn(element.id);
  const aiActivity = getActivityForElement(element.id);

  // Sync rename value when element name changes externally
  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(element.name);
    }
  }, [element.name, isRenaming]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("dragId", element.id);
    e.stopPropagation();
    setDraggingType(element.type);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingType) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let proposed: DropPosition;
    if (y < rect.height * 0.25) proposed = "before";
    else if (y > rect.height * 0.75) proposed = "after";
    else
      proposed = ["section", "wrapper", "row", "col"].includes(element.type)
        ? "inside"
        : "after";

    const targetContainerType =
      proposed === "inside" ? element.type : parentType;
    let effectiveChildType = draggingType;

    // Simulating transformation logic for validation visual feedback
    if (effectiveChildType === "col" && targetContainerType !== "row")
      effectiveChildType = "wrapper";
    else if (effectiveChildType === "wrapper" && targetContainerType === "row")
      effectiveChildType = "col";

    const allowed = DND_RULES[targetContainerType] || [];
    if (allowed.includes(effectiveChildType)) setDropState(proposed);
    else setDropState(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = e.dataTransfer.getData("dragId");
    if (dragId && moveElement && dropState)
      moveElement(dragId, element.id, dropState);
    setDropState(null);
    setDraggingType(null);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim())
      updateElement(element.id, { name: renameValue.trim() });
    else setRenameValue(element.name);
    setIsRenaming(false);
  };

  return (
    <div>
      <div
        id={`layer-${element.id}`}
        className={`relative flex items-center py-2 px-2 cursor-pointer group ${
          selectedElement?.id === element.id
            ? "bg-blue-50 text-blue-700"
            : isAIWorking
            ? "bg-purple-50 text-purple-700"
            : "text-gray-600 hover:bg-gray-100"
        } ${isAIWorking ? "animate-pulse" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 16}px` }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(element.id);
        }}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropState(null)}
        onDrop={handleDrop}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={() => setDraggingType(null)}
      >
        {dropState === "before" && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
        )}
        {dropState === "after" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
        )}
        {dropState === "inside" && (
          <div className="absolute inset-0 border border-blue-500 bg-blue-500/10 z-10 pointer-events-none" />
        )}
        <div
          className="mr-2 p-0.5 rounded cursor-grab text-gray-500 hover:text-gray-900 hover:bg-gray-200 active:cursor-grabbing transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mr-1 cursor-pointer"
        >
          {element.children && element.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 opacity-70" />
            ) : (
              <ChevronRight className="w-3 h-3 opacity-70" />
            )
          ) : (
            <div className="w-3 h-3" />
          )}
        </div>
        {isRenaming ? (
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") {
                setRenameValue(element.name);
                setIsRenaming(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white text-gray-900 text-sm px-1 py-0.5 border border-blue-500 rounded outline-none min-w-0"
          />
        ) : (
          <span
            className="text-sm truncate flex-1 select-none flex items-center gap-1"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsRenaming(true);
            }}
          >
            {element.name}
            {isAIWorking && (
              <span className="flex items-center gap-1 text-purple-600 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">
                  {aiActivity?.activityType === "updating" ? "Updating..." :
                   aiActivity?.activityType === "creating" ? "Creating..." :
                   aiActivity?.activityType === "generating" ? "Generating..." : "Working..."}
                </span>
              </span>
            )}
          </span>
        )}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              duplicateElement(element.id);
            }}
            className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-blue-600"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteElement(element.id);
            }}
            className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {isExpanded &&
        element.children?.map((child) => (
          <LayerItem
            key={child.id}
            element={child}
            depth={depth + 1}
            parentType={element.type}
          />
        ))}
    </div>
  );
};

export const LayersPanel: React.FC = () => {
  const { elements } = useFunnel();
  return (
    <div className="-mx-4">
      {elements.map((el) => (
        <LayerItem key={el.id} element={el} depth={0} parentType="root" />
      ))}
      {elements.length === 0 && (
        <p className="text-center text-gray-500 text-sm mt-4">
          No elements yet.
        </p>
      )}
    </div>
  );
};
