import React from 'react';
import { FileJson, Check } from 'lucide-react';
import { ScaledPreview } from './layouts/PreviewRenderers';
import { SimpleSectionPreview } from './SimpleSectionPreview';
import { MatchedSection } from '../lib/sectionMatcher';

interface SavedSectionCardProps {
  section: MatchedSection;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * A card component that displays a section preview from a saved landing page
 * Shows a scaled preview of the section and the source page name
 */
export const SavedSectionCard: React.FC<SavedSectionCardProps> = ({
  section,
  isSelected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-lg border-2 transition-all duration-200 hover:shadow-lg w-full text-left ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      {/* Preview Area */}
      <div className="h-36 rounded-t-md overflow-hidden relative bg-gray-50">
        <ScaledPreview scale={0.15}>
          <SimpleSectionPreview element={section.sectionElement} />
        </ScaledPreview>
      </div>

      {/* Source Page Info */}
      <div className="p-2 border-t border-gray-100 bg-white rounded-b-lg">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <FileJson className="w-3 h-3 text-purple-400 flex-shrink-0" />
          <span className="truncate" title={section.sourcePage.name}>
            {section.sourcePage.name}
          </span>
        </div>
      </div>

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
    </button>
  );
};

export default SavedSectionCard;
