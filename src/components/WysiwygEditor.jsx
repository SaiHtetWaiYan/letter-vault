import { useState, useEffect, useRef } from 'react';
import ConfirmModal from './ConfirmModal';

export default function WysiwygEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Set the initial innerHTML on load
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []);

  function handleInput() {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Ensure selection is inside our editor
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range;
      }
    }
  }

  function restoreSelection() {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    } else {
      editorRef.current?.focus();
    }
  }

  function execCommand(command, arg = null) {
    restoreSelection();
    document.execCommand(command, false, arg);
    handleInput();
    saveSelection();
  }

  function triggerImageUpload() {
    saveSelection();
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        restoreSelection();
        execCommand('insertImage', e.target.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input value so same image can be uploaded again
    event.target.value = '';
  }

  function clearContent() {
    saveSelection();
    setShowClearConfirm(true);
  }

  const btnCls = "h-7 px-2 rounded text-xs font-semibold text-[var(--parchment-40)] hover:bg-[var(--amber-subtle)] hover:text-[var(--amber)] transition-colors flex-shrink-0";
  const dividerCls = "h-4 w-px bg-[rgba(232,168,76,0.15)] mx-0.5 flex-shrink-0";

  return (
    <div className="rounded-lg border border-[rgba(232,168,76,0.15)] bg-[var(--ink-1)] overflow-hidden transition-colors focus-within:border-[rgba(232,168,76,0.35)]">
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-[rgba(232,168,76,0.1)] bg-[var(--ink-0)] px-2 py-1.5 overflow-x-auto">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('bold')} className={`${btnCls} font-bold w-7`} title="Bold">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('italic')} className={`${btnCls} italic w-7`} title="Italic">I</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('underline')} className={`${btnCls} underline w-7`} title="Underline">U</button>

        <div className={dividerCls} />

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('formatBlock', '<h2>')} className={btnCls} title="Heading 2">H2</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('formatBlock', '<h3>')} className={btnCls} title="Heading 3">H3</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('formatBlock', '<p>')} className={btnCls} title="Paragraph">P</button>

        <div className={dividerCls} />

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('insertUnorderedList')} className={btnCls} title="Bullet list">• List</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('insertOrderedList')} className={btnCls} title="Numbered list">1. List</button>

        <div className={dividerCls} />

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('justifyLeft')} className={`${btnCls} w-7`} title="Align left">⇤</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('justifyCenter')} className={`${btnCls} w-7`} title="Align center">⇔</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execCommand('justifyRight')} className={`${btnCls} w-7`} title="Align right">⇥</button>

        <div className={dividerCls} />

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={triggerImageUpload} className={btnCls} title="Insert image">Image</button>

        <div className="flex-1" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearContent}
          className="h-7 px-2 rounded text-xs font-semibold text-[var(--crimson-bright)] hover:bg-[var(--crimson-bg)] transition-colors flex-shrink-0"
          title="Clear all"
        >
          Clear
        </button>
      </div>

      {/* Content area */}
      <div
        ref={editorRef}
        contentEditable={true}
        onInput={handleInput}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        placeholder={placeholder}
        className="min-h-[220px] max-h-[400px] overflow-y-auto p-4 outline-none text-[var(--parchment)] font-serif text-sm leading-relaxed wysiwyg-output"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(232,168,76,0.2) transparent' }}
      />

      {showClearConfirm && (
        <ConfirmModal
          title="Clear Editor Canvas"
          message="Are you sure you want to delete all text and image content inside the editor? This action cannot be undone."
          onConfirm={() => {
            if (editorRef.current) {
              editorRef.current.innerHTML = '';
              onChange('');
              editorRef.current.focus();
              saveSelection();
            }
            setShowClearConfirm(false);
          }}
          onCancel={() => {
            setShowClearConfirm(false);
            restoreSelection();
          }}
        />
      )}
    </div>
  );
}
