import React, { useEffect, useRef, useMemo } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { autocompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { githubDark } from "@fsegurai/codemirror-theme-github-dark";

/**
 * Create a completion source for environment variables
 * Triggers when user types "env." and shows available env variables
 */
const createEnvCompletionSource = (envVariables = []) => {
  return (context) => {
    // Match "env." pattern
    const word = context.matchBefore(/env\.\w*/);
    if (!word) return null;

    const options = envVariables.map((envVar) => ({
      label: `env.${envVar.key}`,
      type: "variable",
      info: envVar.value ? `Value: ${envVar.value}` : undefined,
      detail: "environment variable",
      apply: `env.${envVar.key}`,
    }));

    return {
      from: word.from,
      options,
      validFor: /^env\.\w*$/,
    };
  };
};

const CodeEditor = ({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  showLineNumbers = true,
  height,
  className,
  envVariables, // Array of {key, value} objects for autocomplete
}) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const isTypingRef = useRef(false);

  // Memoize envVariables to prevent unnecessary re-renders
  // Only recreate when the actual keys change
  const envVarsKey = useMemo(() => {
    if (!envVariables || envVariables.length === 0) return "";
    return envVariables.map((v) => v.key).join(",");
  }, [envVariables]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Build extensions array
    const extensions = [
      basicSetup,
      javascript(),
      githubDark,
      EditorView.lineWrapping, // Enable line wrapping
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
    ];

    // Add autocompletion with env variables if provided
    if (envVariables && envVariables.length > 0) {
      extensions.push(
        autocompletion({
          override: [createEnvCompletionSource(envVariables)],
        })
      );
    }

    // Conditionally add line numbers
    if (!showLineNumbers) {
      // Disable line numbers by reconfiguring the editor
      extensions.push(
        EditorView.theme({
          ".cm-lineNumbers": { display: "none" },
          ".cm-gutters": { display: "none" },
        })
      );
    }

    // Add height styling if provided
    if (height) {
      extensions.push(
        EditorView.theme({
          "&": { height: height },
          ".cm-scroller": { overflowY: "auto" },
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
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, envVarsKey]); // Re-create editor when disabled state or envVariables changes

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
    <div
      ref={editorRef}
      className={`code-editor ${className || ""} ${disabled ? "code-editor--disabled" : ""}`}
      data-disabled={disabled ? "true" : "false"}
      style={{
        overflow: "visible",
        maxWidth: "100%",
        width: "100%",
      }}
    />
  );
};

export default CodeEditor;
