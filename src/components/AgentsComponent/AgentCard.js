import React from "react";
import { Tile, Button } from "@carbon/react";
import { Edit, TrashCan, Download, Chat } from "@carbon/icons-react";
import { truncateText } from "@utils/uiUtils";
import { formatDate } from "@utils/uiUtils";
import { ProviderIcon } from "@components/SettingsComponent/SettingsComponent.utils";
import { CapabilityTags } from "@components/shared";

const AgentCard = ({ agent, onEdit, onDelete, onExport, onChat }) => {
  const toolsCount = agent.selectedTools?.length || 0;
  const hasJsonOutput = agent.useJsonOutput;
  const hasJsonSchema = agent.useJsonSchema && agent.jsonSchema;

  return (
    <Tile className="agent-card">
      <div className="agent-card__header">
        <div className="agent-card__icon">
          <ProviderIcon providerId={agent.coreModel?.providerId} size={24} />
        </div>
        <div className="agent-card__title-section">
          <h4 className="agent-card__title">{agent.name}</h4>
          <span className="agent-card__date">{formatDate(agent.timestamp)}</span>
        </div>
      </div>

      <div className="agent-card__body">
        <div className="agent-card__instructions" title={agent.instructions}>
          {truncateText(agent.instructions || "", 120)}
        </div>

        <div className="agent-card__metadata">
          <div className="agent-card__metadata-item">
            <span className="agent-card__metadata-label">Model:</span>
            <span className="agent-card__metadata-value">
              {agent.coreModel?.text || agent.coreModel?.originalText || "Not set"}
            </span>
          </div>

          <div className="agent-card__tags">
            <CapabilityTags
              toolsCount={toolsCount}
              supportsJsonOutput={hasJsonOutput}
              hasJsonSchema={hasJsonSchema}
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="agent-card__actions">
        {onChat && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Chat}
            iconDescription="Chat"
            tooltipPosition="top"
            hasIconOnly
            onClick={onChat}
          >
            Chat
          </Button>
        )}
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Edit}
          iconDescription="Edit"
          tooltipPosition="top"
          hasIconOnly
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Download}
          iconDescription="Export"
          tooltipPosition="top"
          hasIconOnly
          onClick={onExport}
        >
          Export
        </Button>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={TrashCan}
          iconDescription="Delete"
          tooltipPosition="top"
          hasIconOnly
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </Tile>
  );
};

export default AgentCard;
