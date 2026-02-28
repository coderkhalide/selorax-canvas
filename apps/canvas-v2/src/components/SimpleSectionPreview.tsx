import React from 'react';
import { FunnelElement } from '../types';
import { CUSTOM_BLOCKS } from './custom-registry';
import * as LucideIcons from 'lucide-react';

interface SimpleSectionPreviewProps {
  element: FunnelElement;
}

/**
 * A lightweight preview renderer for section elements
 * Used in SavedSectionCard to show section previews from other landing pages
 */
export const SimpleSectionPreview: React.FC<SimpleSectionPreviewProps> = ({
  element,
}) => {
  // Render custom components using their registered renderers
  if (element.type === 'custom' && element.customType) {
    const CustomDef = CUSTOM_BLOCKS[element.customType];
    if (CustomDef) {
      return <CustomDef.component element={element} isPreview={true} />;
    }
  }

  // Render icon elements
  if (element.type === 'icon' && element.content) {
    const IconComponent = (LucideIcons as any)[element.content];
    if (IconComponent) {
      return (
        <div style={element.style}>
          <IconComponent />
        </div>
      );
    }
  }

  // Render image elements
  if (element.type === 'image' && element.src) {
    return (
      <img
        src={element.src}
        alt={element.name || 'Image'}
        style={{
          ...element.style,
          maxWidth: '100%',
          height: 'auto',
        }}
      />
    );
  }

  // Render text elements (headline, paragraph, button)
  // Use dangerouslySetInnerHTML to properly render HTML content
  if (['headline', 'paragraph', 'button'].includes(element.type)) {
    const Tag =
      element.type === 'headline'
        ? 'h2'
        : element.type === 'paragraph'
          ? 'p'
          : 'button';
    return (
      <Tag
        style={element.style}
        dangerouslySetInnerHTML={{ __html: element.content || '' }}
      />
    );
  }

  // Render container elements (section, wrapper, row, col) with children
  if (['section', 'wrapper', 'row', 'col'].includes(element.type)) {
    return (
      <div
        style={{
          ...element.style,
          width: element.type === 'section' ? '100%' : element.style?.width,
          minHeight: element.type === 'section' ? '100px' : undefined,
        }}
        className="pointer-events-none"
      >
        {element.children?.map((child) => (
          <SimpleSectionPreview key={child.id} element={child} />
        ))}
      </div>
    );
  }

  // Fallback for other element types
  return (
    <div style={element.style} className="pointer-events-none">
      {element.children?.map((child) => (
        <SimpleSectionPreview key={child.id} element={child} />
      ))}
    </div>
  );
};

export default SimpleSectionPreview;
