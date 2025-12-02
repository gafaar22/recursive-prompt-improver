import React from "react";
import {
  FormGroup,
  Button,
  InlineLoading,
  AILabel,
  AILabelContent,
  AILabelActions,
} from "@carbon/react";
import { MagicWandFilled, Undo, Redo, Compare } from "@carbon/react/icons";
import { SpeechTextArea } from "@components/shared";
import { useToast } from "@context/ToastContext";

/**
 * Reusable InstructionsEditor component for editing and improving instructions/prompts
 * Supports AI-powered improvements with undo/redo functionality and diff comparison
 *
 * @param {Object} props
 * @param {string} props.instructions - Current instructions text
 * @param {number} props.instructionsRows - Number of rows for textarea
 * @param {boolean} props.isLoading - Global loading state (disables all actions)
 * @param {boolean} props.isImprovingPrompt - Whether AI is currently improving
 * @param {boolean} props.hasProviders - Whether any providers are configured
 * @param {string|null} props.previousInstructions - Previous version before improvement
 * @param {string|null} props.improvedInstructions - AI-improved version
 * @param {Function} props.onInstructionsChange - Change handler for textarea
 * @param {Function} props.onInstructionsFocus - Focus handler for textarea
 * @param {Function} props.onInstructionsBlur - Blur handler for textarea
 * @param {Function} props.onImprove - Handler for improve/generate button
 * @param {Function} props.onUndo - Handler for undo button
 * @param {Function} props.onRedo - Handler for redo button
 * @param {Function} props.onCompare - Handler for compare button
 * @param {string} [props.id="instructions"] - ID for textarea element
 * @param {string} [props.labelText="Instructions (*)"] - Label text for textarea
 * @param {string} [props.placeholder="Enter instructions..."] - Placeholder text
 * @param {React.Ref} [props.textAreaRef] - Ref for textarea element
 */
const InstructionsEditor = ({
  instructions,
  instructionsRows,
  isLoading,
  isImprovingPrompt,
  hasProviders,
  previousInstructions,
  improvedInstructions,
  onInstructionsChange,
  onInstructionsFocus,
  onInstructionsBlur,
  onImprove,
  onUndo,
  onRedo,
  onCompare,
  id = "instructions",
  labelText = "Instructions (*)",
  placeholder = "Enter instructions (system prompt) here...",
  textAreaRef = null,
}) => {
  const { showError } = useToast();
  const isGenerating = !instructions.trim();
  const isAIImproved = improvedInstructions !== null && instructions === improvedInstructions;

  return (
    <FormGroup>
      <div className="clearForm">
        {isImprovingPrompt ? (
          <InlineLoading
            description={isGenerating ? "Generating instructions..." : "Improving instructions..."}
            status="active"
          />
        ) : (
          <>
            {previousInstructions !== null && instructions === previousInstructions && (
              <Button
                type="button"
                kind="ghost"
                size="sm"
                onClick={onRedo}
                disabled={isLoading || isImprovingPrompt}
                renderIcon={Redo}
              >
                Redo
              </Button>
            )}
            {previousInstructions !== null &&
              improvedInstructions !== null &&
              instructions !== previousInstructions && (
                <Button
                  type="button"
                  kind="ghost"
                  size="sm"
                  onClick={onCompare}
                  disabled={isLoading || isImprovingPrompt}
                  renderIcon={Compare}
                >
                  Compare
                </Button>
              )}
            {previousInstructions !== null && instructions !== previousInstructions && (
              <Button
                type="button"
                kind="ghost"
                size="sm"
                onClick={onUndo}
                disabled={isLoading || isImprovingPrompt}
                renderIcon={Undo}
              >
                Undo
              </Button>
            )}
            <Button
              type="button"
              kind="ghost"
              size="sm"
              onClick={onImprove}
              disabled={isLoading || isImprovingPrompt || !hasProviders}
              renderIcon={MagicWandFilled}
            >
              {isGenerating ? "Generate" : "Improve"}
            </Button>
          </>
        )}
      </div>

      <SpeechTextArea
        ref={textAreaRef}
        id={id}
        labelText={labelText}
        placeholder={placeholder}
        rows={instructionsRows}
        value={instructions}
        onChange={onInstructionsChange}
        onFocus={onInstructionsFocus}
        onBlur={onInstructionsBlur}
        disabled={isLoading || isImprovingPrompt}
        decorator={
          isAIImproved ? (
            <AILabel className="ai-label-container">
              <AILabelContent>
                <div>
                  <h4 className="ai-label-heading">AI Generated</h4>
                  <p className="secondary margin-top-1rem">
                    These instructions were created or improved by AI.
                  </p>
                  <p className="secondary margin-top-1rem">
                    Use the Compare button to view the original version.
                  </p>
                </div>
                <AILabelActions>
                  <Button
                    onClick={onCompare}
                    disabled={isLoading || isImprovingPrompt}
                    renderIcon={Compare}
                  >
                    Compare
                  </Button>
                </AILabelActions>
              </AILabelContent>
            </AILabel>
          ) : undefined
        }
        showError={showError}
      />
    </FormGroup>
  );
};

export default InstructionsEditor;
