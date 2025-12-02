import React from "react";
import {
  Column,
  Button,
  MenuButton,
  MenuItem,
  InlineNotification,
  ActionableNotification,
  MenuItemDivider,
} from "@carbon/react";
import { Play, Bot, Chat, Reset } from "@carbon/react/icons";
import { isImproveDisabled, isFormValid, truncateText } from "@utils/uiUtils";

const ActionsSection = ({
  settings,
  formData,
  isLoading,
  isImprovingPrompt,
  fillingOutputIndex,
  error,
  onChat,
  onSaveAsAgent,
  onClearForm,
  onNavigate,
}) => {
  if (isLoading) return null;

  return (
    <Column lg={16} md={8} sm={4} className="button-column">
      {isFormValid(settings, formData) ? (
        <Button
          type="submit"
          kind="primary"
          size="md"
          renderIcon={Play}
          disabled={
            isLoading ||
            !isFormValid(settings, formData) ||
            isImprovingPrompt ||
            fillingOutputIndex !== null
          }
        >
          {isLoading
            ? "Running..."
            : isImproveDisabled(formData?.improveMode)
              ? "Test only"
              : "Improve and Test"}
        </Button>
      ) : (
        <>
          {error?.length ? (
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={truncateText(error, 200)}
              lowContrast
              hideCloseButton
            />
          ) : !settings.providers?.length ? (
            <ActionableNotification
              kind="warning"
              title="Provider Required"
              subtitle="Please add at least one provider."
              actionButtonLabel="Go to Settings"
              onActionButtonClick={() => onNavigate("/settings")}
              lowContrast
              hideCloseButton
              inline
            />
          ) : (
            <InlineNotification
              kind="info"
              title="Important"
              subtitle={"Fill in all required fields to test"}
              lowContrast
              hideCloseButton
            />
          )}
        </>
      )}
      <MenuButton
        kind="tertiary"
        size="md"
        label="Actions"
        menuTarget={document.querySelector(".rpi")}
        disabled={isLoading || isImprovingPrompt || fillingOutputIndex !== null}
      >
        <MenuItem
          label="Chat"
          renderIcon={Chat}
          onClick={onChat}
          disabled={!settings?.providers?.length || !formData.instructions?.length}
        />
        <MenuItem
          label="Save as agent"
          renderIcon={Bot}
          onClick={onSaveAsAgent}
          disabled={!settings?.providers?.length || !formData.instructions?.length}
        />
        <MenuItemDivider />
        <MenuItem label="Clear Form" renderIcon={Reset} onClick={onClearForm} kind="danger" />
      </MenuButton>
    </Column>
  );
};

export default ActionsSection;
