import React from "react";

export const EditableText = React.memo(
  ({
    tagName,
    html,
    className,
    style,
    editable,
    onBlur,
    elementRef,
    ...props
  }) => {
    const Tag = tagName || "div";

    return (
      <Tag
        ref={elementRef}
        className={className}
        style={style}
        contentEditable={editable}
        suppressContentEditableWarning={true}
        onBlur={onBlur}
        dangerouslySetInnerHTML={{ __html: html }}
        {...props}
      />
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.html === nextProps.html &&
      prevProps.editable === nextProps.editable &&
      JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style) &&
      prevProps.className === nextProps.className
    );
  }
);
