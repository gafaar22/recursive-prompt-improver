import React from "react";
import { Tag } from "@carbon/react";
import { Image, Json, DataStructured, TextLongParagraph, Tools } from "@carbon/icons-react";

/**
 * CapabilityTags - Displays capability tags for models/agents
 * Provides consistent styling across the application
 *
 * @param {Object} props
 * @param {boolean} props.supportsTools - Whether tools/functions are supported
 * @param {boolean} props.supportsVision - Whether vision/image input is supported
 * @param {boolean} props.supportsJsonOutput - Whether JSON output mode is supported
 * @param {boolean} props.hasJsonSchema - Whether a JSON schema is defined (for agents)
 * @param {number} props.toolsCount - Number of tools (for agents, shows count instead of just "Tools")
 * @param {number} props.contextLength - Context length in tokens (optional)
 * @param {string} props.size - Tag size: "sm" or "md" (default: "sm")
 * @param {boolean} props.compactMode - If true, shows icons instead of text (default: false)
 * @param {string} props.className - Additional CSS class
 */
const CapabilityTags = ({
  supportsTools,
  supportsVision,
  supportsJsonOutput,
  hasJsonSchema,
  toolsCount,
  contextLength,
  size = "sm",
  compactMode = false,
  className = "",
}) => {
  // Determine if we should show tools tag
  const showTools = toolsCount > 0 || supportsTools;
  const iconSize = size === "sm" ? 12 : 16;

  return (
    <span className={`capability-tags ${className}`}>
      {/* {contextLength && (
        <Tag size={size} type="gray" title="Context length">
          {compactMode ? (
            <TextLongParagraph size={iconSize} />
          ) : (
            `${contextLength.toLocaleString()} tokens`
          )}
        </Tag>
      )} */}
      {showTools && (
        <Tag size={size} type="purple" title="Supports Tools">
          {compactMode ? (
            <Tools size={iconSize} />
          ) : toolsCount > 0 ? (
            `${toolsCount} ${toolsCount === 1 ? "Tool" : "Tools"}`
          ) : (
            "Tools"
          )}
        </Tag>
      )}
      {supportsVision && (
        <Tag size={size} type="red" title="Supports Vision">
          {compactMode ? <Image size={iconSize} /> : "Vision"}
        </Tag>
      )}
      {supportsJsonOutput && (
        <Tag size={size} type="green" title="Supports JSON Output">
          {compactMode ? <Json size={iconSize} /> : "JSON"}
        </Tag>
      )}
      {hasJsonSchema && (
        <Tag size={size} type="magenta" title="Has JSON Schema">
          {compactMode ? <DataStructured size={iconSize} /> : "Schema"}
        </Tag>
      )}
    </span>
  );
};

export default CapabilityTags;
