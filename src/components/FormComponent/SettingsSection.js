import React from "react";
import { Column, FormGroup, NumberInput, Toggle } from "@carbon/react";
import { isImproveDisabled } from "@utils/uiUtils";
import { getToolsWithDisabledState } from "./FormComponent.utils";
import { MODEL_ITEMS } from "@utils/constants";
import { AdvancedMultiselect, AdvancedSelect } from "@components/shared";

const SettingsSection = ({
  tools,
  selectedTools,
  allAvailableModels,
  coreModel,
  iterations,
  improveMode,
  isLoading,
  onToolsChange,
  onModelChange,
  onIterationsChange,
  onImproveModeToggle,
}) => {
  return (
    <>
      <Column lg={4} md={2} sm={2}>
        <FormGroup className="formGroup">
          <AdvancedMultiselect
            direction="top"
            id="formTools"
            titleText="Tools & Agents"
            label="Select tools and agents"
            items={getToolsWithDisabledState(tools, selectedTools)}
            selectedItems={selectedTools}
            columns={["type", "origin"]}
            filterableColumns={["type", "origin"]}
            showProviderIcon
            itemToString={(item) => {
              if (!item) return "";
              // Show type suffix for agents and MCP tools
              let suffix = "";
              if (item.isAgent) {
                suffix = " (Agent)";
              } else if (item.isMCP) {
                suffix = ` (MCP: ${item.mcpServerName})`;
              }
              return `${item.name}${suffix}`;
            }}
            onChange={({ selectedItems }) => onToolsChange(selectedItems)}
            disabled={isLoading || !tools?.length}
            sortItems={(items) =>
              items.sort((a, b) => {
                if (a.disabled && !b.disabled) return 1;
                if (!a.disabled && b.disabled) return -1;
                return a.name.localeCompare(b.name);
              })
            }
          />
        </FormGroup>
      </Column>

      <Column lg={4} md={2} sm={2}>
        <FormGroup className="formGroup">
          <AdvancedSelect
            id="coreModel"
            titleText="Core Model"
            label="Select a model"
            items={allAvailableModels.length > 0 ? allAvailableModels : MODEL_ITEMS}
            selectedItem={coreModel}
            columns={["providerName", "capabilities"]}
            filterableColumns={["providerName"]}
            itemToString={(item) => (item ? item.text : "")}
            onChange={({ selectedItem }) => onModelChange(selectedItem)}
            disabled={isLoading || allAvailableModels.length === 0}
            showProviderIcon
          />
        </FormGroup>
      </Column>

      <Column lg={4} md={2} sm={2}>
        <FormGroup className="formGroup">
          <NumberInput
            id="iterations"
            label="Improver iterations"
            min={1}
            max={100}
            value={!isImproveDisabled(improveMode) ? iterations : 1}
            onChange={(e, { value }) => onIterationsChange(value)}
            disabled={isLoading || isImproveDisabled(improveMode)}
          />
        </FormGroup>
      </Column>

      <Column lg={4} md={2} sm={2}>
        <FormGroup className="formGroup">
          <Toggle
            id="improveMode"
            labelText="Improve Mode"
            labelA="Test only"
            labelB="Improve and test"
            toggled={!isImproveDisabled(improveMode)}
            onToggle={onImproveModeToggle}
            disabled={isLoading}
          />
        </FormGroup>
      </Column>
    </>
  );
};

export default SettingsSection;
