import React from "react";
import {
  Button,
  Column,
  Grid,
  Accordion,
  AccordionItem,
  TextInput,
  CodeSnippet,
} from "@carbon/react";
import { Edit, TrashCan, Add } from "@carbon/react/icons";

const EnvironmentVariablesSection = ({
  environmentVariables,
  showEnvVarForm,
  editingEnvVarIndex,
  envVarKey,
  envVarValue,
  envVarKeyError,
  onAddEnvVar,
  onEditEnvVar,
  onDeleteEnvVar,
  onSaveEnvVar,
  onCancelEnvVar,
  onEnvVarKeyChange,
  onEnvVarValueChange,
}) => {
  return (
    <Column lg={16} md={8} sm={4}>
      <h5 className="settings-section-title--spaced">Environment Variables</h5>
      <p className="settings-env-description">
        Environment variables defined here will be available in tool functions as{" "}
        <CodeSnippet type="inline" hideCopyButton>
          env.VARIABLE_NAME
        </CodeSnippet>
        <br />
        Use them to store configuration values, API keys, or any other data your tools need.
      </p>
      <Accordion>
        <AccordionItem
          title={`Environment Variables ${environmentVariables?.length ? `(${environmentVariables?.length})` : ""}`}
        >
          <div className="settings-env-accordion-content">
            {/* Add/Edit Form */}
            {showEnvVarForm && (
              <div className="settings-env-form">
                <Grid>
                  <Column lg={8} md={4} sm={4}>
                    <TextInput
                      id="env-var-key"
                      labelText="Key"
                      placeholder="e.g., API_KEY, DATABASE_URL"
                      value={envVarKey}
                      onChange={onEnvVarKeyChange}
                      invalid={!!envVarKeyError}
                      invalidText={envVarKeyError}
                    />
                  </Column>
                  <Column lg={8} md={4} sm={4}>
                    <TextInput
                      id="env-var-value"
                      labelText="Value"
                      placeholder="Enter value"
                      value={envVarValue}
                      onChange={onEnvVarValueChange}
                    />
                  </Column>
                  <Column lg={16} md={8} sm={4} className="settings-env-form-actions">
                    <Button size="sm" onClick={onSaveEnvVar}>
                      {editingEnvVarIndex !== null ? "Update" : "Add"}
                    </Button>
                    <Button size="sm" kind="tertiary" onClick={onCancelEnvVar}>
                      Cancel
                    </Button>
                  </Column>
                </Grid>
              </div>
            )}

            {/* List of Environment Variables */}
            {environmentVariables && environmentVariables.length > 0 ? (
              <div className="settings-env-list">
                {environmentVariables.map((envVar, index) => (
                  <div key={index} className="settings-env-item">
                    <div className="settings-env-item-content">
                      <strong>{envVar.key}</strong>
                      <div className="settings-env-item-value">{envVar.value}</div>
                    </div>
                    <div className="settings-env-item-actions">
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={Edit}
                        iconDescription="Edit"
                        hasIconOnly
                        onClick={() => onEditEnvVar(index)}
                      />
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={TrashCan}
                        iconDescription="Delete"
                        hasIconOnly
                        onClick={() => onDeleteEnvVar(index)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : showEnvVarForm ? null : (
              <div className="settings-empty-state">
                No environment variables defined. Click Add Variable to get started.
                <Button size="sm" kind="ghost" renderIcon={Add} onClick={onAddEnvVar}>
                  Add Variable
                </Button>
              </div>
            )}

            {/* Add Button */}
            {!showEnvVarForm && environmentVariables.length > 0 && (
              <div className="settings-env-add-button">
                <Button size="sm" kind="ghost" renderIcon={Add} onClick={onAddEnvVar}>
                  Add Variable
                </Button>
              </div>
            )}
          </div>
        </AccordionItem>
      </Accordion>
    </Column>
  );
};

export default EnvironmentVariablesSection;
