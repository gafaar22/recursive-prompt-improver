import React, { useRef, useEffect, memo, useMemo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Link,
  OrderedList,
  UnorderedList,
  ListItem,
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Heading,
  Section,
  CodeSnippet,
  IconButton,
} from "@carbon/react";
import { Copy, Checkmark, View } from "@carbon/icons-react";
import { openHtmlPreview } from "@utils/internalBrowser";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { githubDark } from "@fsegurai/codemirror-theme-github-dark";

/**
 * Get language extension for CodeMirror based on language name
 */
const getLanguageExtension = (language) => {
  const lang = language?.toLowerCase();
  switch (lang) {
    case "javascript":
    case "js":
      return javascript();
    case "json":
      return json();
    case "python":
    case "py":
      return python();
    case "htm":
    case "html":
    case "xhtml":
      return html();
    case "css":
      return css();
    case "markdown":
    case "md":
      return markdown();
    case "sql":
      return sql();
    case "xml":
      return xml();
    default:
      return javascript(); // Default to JavaScript
  }
};

/**
 * CodeBlock component using CodeMirror
 * Memoized to prevent re-renders when content/language unchanged
 */
const CodeBlock = memo(({ language, children }) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const isHtml = ["xhtml", "html", "htm"].includes(language?.toLowerCase());

  const handleCopy = useCallback(async () => {
    const text = children || "";
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: use execCommand with temporary textarea
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  const handleView = useCallback(() => {
    openHtmlPreview(children || "", { title: "HTML Preview" });
  }, [children]);

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      getLanguageExtension(language),
      githubDark,
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ];

    const startState = EditorState.create({
      doc: children || "",
      extensions,
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [children, language]);

  return (
    <div className="markdown-code-block-wrapper">
      <div ref={editorRef} className="markdown-code-block" />
      <div className="markdown-code-actions">
        {isHtml && (
          <IconButton kind="ghost" size="sm" align="left" label="Preview" onClick={handleView}>
            <View />
          </IconButton>
        )}
        <IconButton
          kind="ghost"
          size="sm"
          align="left"
          label={copied ? "Copied!" : "Copy"}
          onClick={handleCopy}
        >
          {copied ? <Checkmark /> : <Copy />}
        </IconButton>
      </div>
    </div>
  );
});

/**
 * Image component
 * Memoized to prevent re-renders when src/alt unchanged
 */
const MarkdownImage = memo(({ src, alt }) => {
  return <img src={src} alt={alt} className="markdown-image" />;
});

/**
 * MarkdownContent component
 * Renders markdown content with Carbon Design System styling
 * Optimized for streaming with memoized components
 */
const MarkdownContent = memo(({ content }) => {
  if (!content) return null;

  // Memoize components object to prevent re-creating on each render
  const components = useMemo(
    () => ({
      code({ node, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        const language = match ? match[1] : null;
        const codeContent = String(children).replace(/\n$/, "");
        const hasNewline = String(children).includes("\n");
        const isInline = !className && !hasNewline;

        if (!isInline) {
          // Multi-line code block with CodeMirror
          return <CodeBlock language={language}>{codeContent}</CodeBlock>;
        } else {
          // Inline code
          return (
            <CodeSnippet
              className="markdown-inline-code"
              type="inline"
              disabled={true}
              hideCopyButton={true}
            >
              {children}
            </CodeSnippet>
          );
        }
      },
      // Headings - using Carbon Heading component
      h1: ({ children }) => (
        <Section level={1}>
          <Heading className="markdown-h1">{children}</Heading>
        </Section>
      ),
      h2: ({ children }) => (
        <Section level={2}>
          <Heading className="markdown-h2">{children}</Heading>
        </Section>
      ),
      h3: ({ children }) => (
        <Section level={3}>
          <Heading className="markdown-h3">{children}</Heading>
        </Section>
      ),
      h4: ({ children }) => (
        <Section level={4}>
          <Heading className="markdown-h4">{children}</Heading>
        </Section>
      ),
      h5: ({ children }) => (
        <Section level={5}>
          <Heading className="markdown-h5">{children}</Heading>
        </Section>
      ),
      h6: ({ children }) => (
        <Section level={6}>
          <Heading className="markdown-h6">{children}</Heading>
        </Section>
      ),
      // Paragraphs
      p: ({ children }) => <div className="markdown-paragraph">{children}</div>,
      // Lists - using Carbon components
      ul: ({ children }) => (
        <UnorderedList className="markdown-list markdown-list--unordered">{children}</UnorderedList>
      ),
      ol: ({ children }) => (
        <OrderedList className="markdown-list markdown-list--ordered">{children}</OrderedList>
      ),
      li: ({ children }) => <ListItem className="markdown-list-item">{children}</ListItem>,
      // Links - using Carbon Link component
      a: ({ href, children }) => (
        <Link href={href} className="markdown-link" target="_blank" rel="noopener noreferrer">
          {children}
        </Link>
      ),
      // Blockquotes
      blockquote: ({ children }) => (
        <blockquote className="markdown-blockquote">{children}</blockquote>
      ),
      // Tables - using Carbon Table components
      table: ({ children }) => (
        <Table className="markdown-table" size="sm">
          {children}
        </Table>
      ),
      thead: ({ children }) => <TableHead>{children}</TableHead>,
      tbody: ({ children }) => <TableBody>{children}</TableBody>,
      tr: ({ children }) => <TableRow>{children}</TableRow>,
      th: ({ children }) => <TableHeader className="markdown-table-header">{children}</TableHeader>,
      td: ({ children }) => <TableCell className="markdown-table-cell">{children}</TableCell>,
      // Horizontal rule
      hr: () => <hr className="markdown-hr" />,
      // Strong/Bold
      strong: ({ children }) => <strong className="markdown-strong">{children}</strong>,
      // Emphasis/Italic
      em: ({ children }) => <em className="markdown-em">{children}</em>,
      // Images
      img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
    }),
    []
  );

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownContent;
