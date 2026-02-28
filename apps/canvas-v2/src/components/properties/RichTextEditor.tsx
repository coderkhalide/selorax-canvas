import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Link } from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Type,
  Link as LinkIcon,
  Unlink,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListTodo,
  ChevronDown,
  Check,
  X,
  CodeXml,
  Palette,
} from "lucide-react";

export const RichTextEditor: React.FC<{
  content: string;
  onChange: (html: string) => void;
  style?: React.CSSProperties;
}> = ({ content, onChange, style }) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showHeadings, setShowHeadings] = useState(false);
  const [isCodeView, setIsCodeView] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const HIGHLIGHT_COLORS = [
    { color: "#8ce99a", label: "Green" },
    { color: "#74c0fc", label: "Blue" },
    { color: "#ff8787", label: "Red" },
    { color: "#da77f2", label: "Purple" },
    { color: "#ffd43b", label: "Yellow" },
  ];

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      let html = editor.getHTML();
      // Remove trailing empty paragraph that Tiptap automatically adds
      if (html.endsWith("<p></p>")) {
        html = html.slice(0, -7);
      }
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none p-2 bg-white text-sm text-gray-900 focus:outline-none min-h-[120px] max-h-[300px] overflow-y-auto leading-normal rounded-b-lg",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      if (!editor.isFocused) editor.commands.setContent(content);
    }
  }, [content, editor]);

  const toggleLinkInput = () => {
    if (!editor) return;

    if (showLinkInput) {
      setShowLinkInput(false);
      setLinkUrl("");
    } else {
      const previousUrl = editor.getAttributes("link").href;
      setLinkUrl(previousUrl || "");
      setShowLinkInput(true);
    }
  };

  const applyLink = () => {
    if (!editor) return;

    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  };

  if (!editor) return null;

  return (
    <div
      className="border border-gray-200 rounded-lg mb-4 shadow-sm relative"
      style={style}
    >
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50 items-center rounded-t-lg">
        {/* Headings Dropdown */}
        <div className="relative border-r border-gray-300 pr-2 mr-2">
          <button
            onClick={() => setShowHeadings(!showHeadings)}
            className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Headings"
          >
            <span className="font-bold text-xs">H</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showHeadings && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 flex flex-col p-1 min-w-[120px]">
              <button
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                  setShowHeadings(false);
                }}
                className={`flex items-center gap-2 p-2 text-sm hover:bg-gray-100 rounded text-left ${editor.isActive("heading", { level: 1 }) ? "bg-blue-50 text-blue-600" : "text-gray-700"}`}
              >
                <Heading1 className="w-4 h-4" /> Heading 1
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  setShowHeadings(false);
                }}
                className={`flex items-center gap-2 p-2 text-sm hover:bg-gray-100 rounded text-left ${editor.isActive("heading", { level: 2 }) ? "bg-blue-50 text-blue-600" : "text-gray-700"}`}
              >
                <Heading2 className="w-4 h-4" /> Heading 2
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                  setShowHeadings(false);
                }}
                className={`flex items-center gap-2 p-2 text-sm hover:bg-gray-100 rounded text-left ${editor.isActive("heading", { level: 3 }) ? "bg-blue-50 text-blue-600" : "text-gray-700"}`}
              >
                <Heading3 className="w-4 h-4" /> Heading 3
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 4 }).run();
                  setShowHeadings(false);
                }}
                className={`flex items-center gap-2 p-2 text-sm hover:bg-gray-100 rounded text-left ${editor.isActive("heading", { level: 4 }) ? "bg-blue-50 text-blue-600" : "text-gray-700"}`}
              >
                <Heading4 className="w-4 h-4" /> Heading 4
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setShowHeadings(false);
                }}
                className={`flex items-center gap-2 p-2 text-sm hover:bg-gray-100 rounded text-left ${editor.isActive("paragraph") ? "bg-blue-50 text-blue-600" : "text-gray-700"}`}
              >
                <span className="w-4 text-center text-xs font-bold">P</span>{" "}
                Paragraph
              </button>
            </div>
          )}
        </div>

        {/* Lists */}
        <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("bulletList") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("orderedList") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Ordered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              (editor.chain().focus() as any).toggleTaskList().run()
            }
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("taskList") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Task List"
          >
            <ListTodo className="w-4 h-4" />
          </button>
          {/* Links */}
          <div className="flex gap-0.5  border-gray-300 pl-2 ">
            <button
              onClick={toggleLinkInput}
              className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("link") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
              title="Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            {editor.isActive("link") && (
              <button
                onClick={() => editor.chain().focus().unsetLink().run()}
                className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600"
                title="Unlink"
              >
                <Unlink className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Code View Toggle */}
          <button
            onClick={() => {
              if (!isCodeView && editor) {
                const html = editor.getHTML();
                if (html !== content) {
                  onChange(html);
                }
              }
              setIsCodeView(!isCodeView);
            }}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${isCodeView ? "bg-purple-100 text-purple-700" : "text-gray-600"}`}
            title={isCodeView ? "Show Preview" : "Show HTML"}
          >
            <CodeXml className="w-4 h-4" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
          <button
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: "left" }) ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: "center" }) ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: "right" }) ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        {/* Basic Formatting */}
        <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("bold") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("italic") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("underline") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("strike") ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Colors */}
        <div className="flex gap-0.5 items-center  border-gray-300 pr-2 mr-2 relative">
          <div
            className="relative flex items-center justify-center p-1.5 rounded hover:bg-gray-200 cursor-pointer text-gray-600"
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
            <input
              type="color"
              onInput={(event) =>
                editor
                  .chain()
                  .focus()
                  .setColor((event.target as HTMLInputElement).value)
                  .run()
              }
              value={editor.getAttributes("textStyle").color || "#000000"}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </div>
          <div className="relative">
            {showHighlightPicker && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowHighlightPicker(false)}
              />
            )}
            <button
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive("highlight") ? "text-purple-600" : "text-gray-600"}`}
              title="Highlight"
            >
              <Highlighter className="w-4 h-4" />
            </button>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 flex items-center gap-1 p-1.5 min-w-0">
                {HIGHLIGHT_COLORS.map((item) => (
                  <button
                    key={item.color}
                    onClick={() => {
                      editor
                        .chain()
                        .focus()
                        .toggleHighlight({ color: item.color })
                        .run();
                      setShowHighlightPicker(false);
                    }}
                    className={`w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform ${editor.isActive("highlight", { color: item.color }) ? "ring-2 ring-offset-1 ring-blue-500" : ""}`}
                    style={{ backgroundColor: item.color }}
                    title={item.label}
                  />
                ))}
                <div className="w-px h-3 bg-gray-200 mx-0.5" />
                <button
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setShowHighlightPicker(false);
                  }}
                  className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-500"
                  title="No Highlight"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Link Input Popover */}
      {showLinkInput && (
        <div className="absolute top-10 left-0 right-0 z-20 px-2">
          <div className="flex items-center gap-1 bg-white border border-gray-200 shadow-lg rounded-lg p-1.5">
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Enter URL..."
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLink();
                if (e.key === "Escape") {
                  setShowLinkInput(false);
                  setLinkUrl("");
                }
              }}
            />
            <button
              onClick={applyLink}
              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Apply Link"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl("");
              }}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {isCodeView ? (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[150px] max-h-[400px] p-3 font-mono text-sm bg-gray-900 text-gray-100 resize-y focus:outline-none leading-relaxed rounded-b-lg"
          spellCheck={false}
          placeholder="Enter HTML content..."
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
};
