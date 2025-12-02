import React from "react";
import { Grid, Column, FormGroup, Button, TextArea, InlineLoading } from "@carbon/react";
import { Reset, Maximize, Minimize } from "@carbon/react/icons";
import { isImproveDisabled } from "@utils/uiUtils";
import { CORE } from "@core/MAIN";

const OutputSection = ({
  isLoading,
  isFullscreen,
  logs,
  currentIteration,
  iterations,
  improveMode,
  outputLog,
  onToggleFullscreen,
  showError,
  showInfo,
  clearOutputFromLocalStorage,
  clearLogs,
  logger,
}) => {
  return (
    <Grid id="outputcontainer">
      <Column lg={16} md={8} sm={4} className="status-column">
        {isLoading ? (
          <div className="loadingAndAbortContainer">
            <InlineLoading
              description={
                isImproveDisabled(improveMode)
                  ? "Testing..."
                  : currentIteration
                    ? `Running iteration ${currentIteration} of ${iterations}`
                    : "Starting..."
              }
              status="active"
            />
            <Button
              kind="ghost"
              size="sm"
              onClick={async () => {
                try {
                  CORE.stop();
                  logger("⛔ Operation stopped by user");
                } catch (e) {
                  console.error(e);
                  showError("Stop failed", e?.message || String(e));
                }
              }}
            >
              Stop
            </Button>
          </div>
        ) : null}
      </Column>

      <Column lg={16} md={8} sm={4}>
        <hr className="margin-03rem-0" />
      </Column>

      <Column lg={16} md={8} sm={4}>
        <FormGroup className="formGroup">
          <div className="outputActionsContainer">
            <Button
              type="button"
              kind="ghost"
              size="sm"
              onClick={() => {
                clearLogs();
                clearOutputFromLocalStorage();
                showInfo("Logs cleared", "Output logs have been cleared");
              }}
              renderIcon={Reset}
            >
              Clear Logs
            </Button>
            <Button
              type="button"
              kind="ghost"
              size="sm"
              onClick={onToggleFullscreen}
              renderIcon={isFullscreen ? Minimize : Maximize}
            >
              {isFullscreen ? "Minimize" : "Maximize"}
            </Button>
          </div>

          <TextArea
            ref={outputLog}
            id="output"
            className={`outputTextarea ${isFullscreen ? "isFullsceen" : ""}`}
            labelText="Logs"
            placeholder="Logging will appear here..."
            rows={8}
            value={logs}
            readOnly
          />
        </FormGroup>
      </Column>
    </Grid>
  );
};

export default OutputSection;
