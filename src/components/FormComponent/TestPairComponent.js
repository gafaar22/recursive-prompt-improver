import React from "react";
import {
  Column,
  FormGroup,
  Button,
  DismissibleTag,
  TextArea,
  Tooltip,
  InlineLoading,
} from "@carbon/react";
import {
  Chat,
  Copy,
  Json,
  Settings,
  TrashCan,
  Tools,
  Information,
  AiLaunch,
  NotebookReference,
  Image as ImageIcon,
  Replicate,
} from "@carbon/react/icons";
import { CHECK_TYPES, MAX_NUM_TESTS } from "@utils/constants";
import { buildDetailedTooltipContent } from "./FormComponent.utils";
import { ProviderIcon } from "@components/SettingsComponent/SettingsComponent.utils";

const TestPairComponent = ({
  pair,
  index,
  isLoading,
  isImprovingPrompt,
  isFillingOutput,
  testPairRowFocused,
  totalPairs,
  lastSessionScore,
  onInputChange,
  onOutputChange,
  onInputFocus,
  onInputBlur,
  onOutputFocus,
  onOutputBlur,
  onSettingsClick,
  onFillOutput,
  onDuplicate,
  onRemove,
  onRemoveCheckType,
  onRemoveJsonSchema,
  onRemoveContext,
  onRemoveKnowledgeBases,
  onRemoveImages,
  onRemoveModel,
}) => {
  return (
    <Column lg={16} md={8} sm={4} className="padding-0-0-08rem" key={index}>
      <FormGroup>
        <div className="testAboveActionsContainer">
          <div className={"testLastScoreContainer"}>
            {!!lastSessionScore && (
              <Tooltip
                label={buildDetailedTooltipContent(lastSessionScore)?.map((l, j) => (
                  <span key={j}>
                    {l}
                    <br />
                  </span>
                ))}
                align="right-start"
              >
                <button
                  type="button"
                  className="tooltip-icon-button"
                  tabIndex={-1}
                  aria-label="Last session score details"
                >
                  <Information size={16} />
                </button>
              </Tooltip>
            )}
          </div>
          <div className={"testSettingsContainer"}>
            {pair.settings.checkTypes.includes(CHECK_TYPES.TOOLS_CALL.id) && (
              <DismissibleTag
                size="md"
                type="purple"
                className="appliedContextTag"
                renderIcon={Tools}
                text={pair.settings?.toolsCalled?.length || ""}
                tagTitle={"Verify tools call"}
                dismissTooltipAlignment="bottom"
                dismissTooltipLabel="Remove"
                title="Remove"
                onClose={(e) => {
                  e.preventDefault();
                  onRemoveCheckType(index, CHECK_TYPES.TOOLS_CALL.id);
                }}
              />
            )}
            {pair.settings.checkTypes.includes(CHECK_TYPES.JSON_VALID.id) && (
              <DismissibleTag
                size="md"
                type="green"
                className="appliedContextTag"
                renderIcon={Json}
                text={"✓"}
                tagTitle={"Json valid"}
                dismissTooltipAlignment="bottom"
                dismissTooltipLabel="Remove"
                title="Remove"
                onClose={(e) => {
                  e.preventDefault();
                  onRemoveCheckType(index, CHECK_TYPES.JSON_VALID.id);
                }}
              />
            )}
            {pair.settings.checkTypes.includes(CHECK_TYPES.JSON_VALID.id) &&
              pair.settings.useJsonSchema &&
              pair.settings.jsonSchema && (
                <DismissibleTag
                  size="md"
                  type="magenta"
                  className="appliedContextTag"
                  renderIcon={Json}
                  text={"S"}
                  tagTitle={"Json schema validation"}
                  dismissTooltipAlignment="bottom"
                  dismissTooltipLabel="Remove"
                  title="Remove"
                  onClose={(e) => {
                    e.preventDefault();
                    onRemoveJsonSchema(index);
                  }}
                />
              )}
            {pair.settings.context && (
              <DismissibleTag
                size="md"
                type="cyan"
                className="appliedContextTag"
                renderIcon={Chat}
                text={"C"} //{pair.settings.context.name}
                tagTitle={"Context"}
                dismissTooltipAlignment="bottom"
                dismissTooltipLabel="Remove"
                title="Remove"
                onClose={(e) => {
                  e.preventDefault();
                  onRemoveContext(index);
                }}
              />
            )}
            {pair.settings.knowledgeBases && pair.settings.knowledgeBases.length > 0 && (
              <DismissibleTag
                size="md"
                type="gray"
                className="appliedContextTag"
                renderIcon={NotebookReference}
                text={`${pair.settings.knowledgeBases.length}`}
                tagTitle={`Knowledge Bases: ${pair.settings.knowledgeBases.map((kb) => kb.name).join(", ")}`}
                dismissTooltipAlignment="bottom"
                dismissTooltipLabel="Remove"
                title="Remove"
                onClose={(e) => {
                  e.preventDefault();
                  onRemoveKnowledgeBases(index);
                }}
              />
            )}
            {pair.settings.images && pair.settings.images.length > 0 && (
              <DismissibleTag
                size="md"
                type="teal"
                className="appliedContextTag"
                renderIcon={ImageIcon}
                text={`${pair.settings.images.length}`}
                tagTitle={`Images: ${pair.settings.images.map((img) => img.name).join(", ")}`}
                dismissTooltipAlignment="bottom"
                dismissTooltipLabel="Remove"
                title="Remove"
                onClose={(e) => {
                  e.preventDefault();
                  onRemoveImages(index);
                }}
              />
            )}
            {pair.settings.model && (
              <DismissibleTag
                size="md"
                type="high-contrast"
                className="appliedContextTag"
                text={
                  <ProviderIcon
                    providerId={pair.settings.model.providerId}
                    size={14}
                    className="padding-top-3px inverse"
                  />
                }
                tagTitle={`Model: ${pair.settings.model.text || pair.settings.model.id}`}
                dismissTooltipAlignment="bottom"
                dismissTooltipLabel="Remove"
                title="Remove"
                onClose={(e) => {
                  e.preventDefault();
                  onRemoveModel(index);
                }}
              />
            )}
            <Button
              kind="ghost"
              size="sm"
              iconDescription="Options"
              hasIconOnly={true}
              renderIcon={Settings}
              tooltipPosition="bottom"
              onClick={() => onSettingsClick(index)}
              disabled={isLoading}
            />
            <Button
              kind="ghost"
              size="sm"
              iconDescription="Duplicate"
              hasIconOnly={true}
              renderIcon={Replicate}
              tooltipPosition="bottom"
              onClick={() => onDuplicate(index)}
              disabled={isLoading || totalPairs >= MAX_NUM_TESTS}
            />
            <Button
              kind="ghost"
              size="sm"
              iconDescription="Delete"
              hasIconOnly={true}
              renderIcon={TrashCan}
              tooltipPosition="left"
              onClick={() => onRemove(index)}
              disabled={isLoading || totalPairs < 2}
            />
          </div>
        </div>
        <div className="textAreasContainer">
          <div className="testIn">
            <TextArea
              id={`in-${index}`}
              labelText={"ㅤ"}
              placeholder="Enter test input here..."
              rows={testPairRowFocused === index ? 6 : 1}
              value={pair.in}
              onChange={(e) => onInputChange(index, e.target.value)}
              onFocus={() => onInputFocus(index)}
              onBlur={() => onInputBlur()}
              disabled={isLoading || isFillingOutput}
              helperText={`Test input ${index + 1} ${index === 0 ? "(*)" : ""}`}
            />
          </div>
          <div className="autoFillOutput">
            <Button
              type="button"
              kind="ghost"
              size="md"
              iconDescription="Auto-fill output"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFillOutput(index);
              }}
              disabled={isLoading || isImprovingPrompt || isFillingOutput || !pair.in.trim()}
              renderIcon={AiLaunch}
              hasIconOnly={true}
            />
          </div>
          <div className="testOut">
            <TextArea
              id={`out-${index}`}
              labelText={"ㅤ"}
              placeholder={
                isFillingOutput ? "Generating output..." : "Enter expected output here..."
              }
              rows={testPairRowFocused === index ? 6 : 1}
              value={pair.out}
              onChange={(e) => onOutputChange(index, e.target.value)}
              onFocus={() => onOutputFocus(index)}
              onBlur={() => onOutputBlur()}
              disabled={
                isLoading ||
                isFillingOutput ||
                pair.settings.checkTypes.includes(CHECK_TYPES.TOOLS_CALL.id)
              }
              helperText={
                isFillingOutput ? (
                  <InlineLoading
                    className="inlineLoadingAsHelperText"
                    description="Generating output..."
                    status="active"
                  />
                ) : pair.settings.checkTypes.includes(CHECK_TYPES.TOOLS_CALL.id) ? (
                  `Test is checking tool calls, output is not needed`
                ) : (
                  `Expected output ${index + 1}`
                )
              }
            />
          </div>
        </div>
      </FormGroup>
    </Column>
  );
};

export default TestPairComponent;
