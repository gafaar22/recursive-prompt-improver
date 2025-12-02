import React from "react";

const AgentCardSkeleton = () => {
  return (
    <div className="agent-card-skeleton">
      <div className="agent-card-skeleton__header">
        <div className="agent-card-skeleton__icon"></div>
        <div className="agent-card-skeleton__title-section">
          <div className="agent-card-skeleton__title"></div>
          <div className="agent-card-skeleton__date"></div>
        </div>
      </div>
      <div className="agent-card-skeleton__body">
        <div className="agent-card-skeleton__instructions"></div>
        <div className="agent-card-skeleton__instructions"></div>
        <div className="agent-card-skeleton__instructions"></div>
      </div>
      <div className="agent-card-skeleton__actions">
        <div className="agent-card-skeleton__action-button"></div>
        <div className="agent-card-skeleton__action-button"></div>
        <div className="agent-card-skeleton__action-button"></div>
        <div className="agent-card-skeleton__action-button"></div>
      </div>
    </div>
  );
};

export default AgentCardSkeleton;
