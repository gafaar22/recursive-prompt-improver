import React, { useEffect, useRef, useMemo } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { autocompletion } from "@codemirror/autocomplete";
import { placeholder } from "@codemirror/view";
import { githubDark } from "@fsegurai/codemirror-theme-github-dark";

/**
 * JsonSchemaEditor - A CodeMirror-based JSON editor with validation
 *
 * @param {string} value - The JSON string value
 * @param {function} onChange - Callback when content changes
 * @param {boolean} readOnly - Whether the editor is read-only
 * @param {boolean} disabled - Whether the editor is disabled (prevents user edits but allows programmatic changes)
 * @param {string} height - CSS height value (e.g., "200px")
 * @param {string} className - Additional CSS classes
 * @param {string} placeholder - Placeholder text
 * @param {boolean} showValidation - Whether to show validation messages (default: true)
 * @param {string} helperText - Helper text to display below editor
 * @param {boolean} invalid - Whether to show invalid state styling
 * @param {string} invalidText - Custom invalid text (overrides default validation message)
 */
const JsonSchemaEditor = ({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  height,
  className,
  placeholder: placeholderText,
  showValidation = true,
  helperText,
  invalid,
  invalidText,
}) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const isTypingRef = useRef(false);

  // Validate JSON
  const validationResult = useMemo(() => {
    if (!value || !value.trim()) {
      return { isValid: true, error: null };
    }
    try {
      JSON.parse(value);
      return { isValid: true, error: null };
    } catch (e) {
      return { isValid: false, error: e.message };
    }
  }, [value]);

  // Determine if we should show invalid state
  const showInvalidState = invalid !== undefined ? invalid : !validationResult.isValid;
  const displayInvalidText = invalidText || validationResult.error || "Invalid JSON format";

  useEffect(() => {
    if (!editorRef.current) return;

    // Build extensions array
    const extensions = [
      basicSetup,
      json(),
      githubDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange && !disabled) {
          isTypingRef.current = true;
          onChange(update.state.doc.toString());
          // Reset typing flag after a short delay
          setTimeout(() => {
            isTypingRef.current = false;
          }, 0);
        }
      }),
      EditorView.editable.of(!readOnly && !disabled),
      EditorState.readOnly.of(readOnly || disabled),
      // Hide line numbers and gutters
      EditorView.theme({
        ".cm-lineNumbers": { display: "none" },
        ".cm-gutters": { display: "none" },
      }),
    ];

    // Add placeholder if provided
    if (placeholderText) {
      extensions.push(placeholder(placeholderText));
    }

    // Add height styling if provided
    if (height) {
      extensions.push(
        EditorView.theme({
          "&": { height: height },
          ".cm-scroller": { overflow: "auto" },
        })
      );
    }

    // Create editor state
    const startState = EditorState.create({
      doc: value || "",
      extensions,
    });

    // Create editor view
    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
      extensions: [
        basicSetup,
        autocompletion({
          tooltipSpace: editorRef.current,
        }),
      ],
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [disabled]); // Re-create editor when disabled state changes

  // Update editor content when value prop changes externally (but not when user is typing)
  useEffect(() => {
    if (viewRef.current && !isTypingRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value || "",
        },
      });
    }
  }, [value]);

  return (
    <div className={`json-schema-editor-wrapper ${className || ""}`}>
      <div
        ref={editorRef}
        className={`json-schema-editor ${showInvalidState ? "json-schema-editor--invalid" : ""} ${disabled ? "json-schema-editor--disabled" : ""}`}
        data-invalid={showInvalidState ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        style={{
          overflow: "visible",
          maxWidth: "100%",
          width: "100%",
        }}
      />
      {showValidation && showInvalidState && (
        <div className="cds--form__helper-text form-helper-text-error">{displayInvalidText}</div>
      )}
      {helperText && !showInvalidState && (
        <div className="cds--form__helper-text" style={{ marginBottom: "1px" }}>
          {helperText}
        </div>
      )}
    </div>
  );
};

export default JsonSchemaEditor;
