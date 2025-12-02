import React from "react";
import { Tile } from "@carbon/react";

const EmptyState = ({ icon: Icon, title, description }) => {
  return (
    <Tile className="empty-state">
      <div className="empty-state__content">
        {Icon && (
          <div className="empty-state__icon">
            <Icon />
          </div>
        )}
        <h3 className="empty-state__title">{title}</h3>
        {description && <p className="empty-state__description">{description}</p>}
      </div>
    </Tile>
  );
};

export default EmptyState;
