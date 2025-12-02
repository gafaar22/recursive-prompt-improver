import React, { useState, useEffect } from "react";
import { Modal, TextArea, InlineNotification, Loading, FormGroup } from "@carbon/react";
import { executeSandboxedFunction, validateFunctionCode } from "@utils/toolUtils";
import JsonSchemaEditor from "@components/shared/JsonSchemaEditor";
import { generateExampleParameters } from "./TestFunctionModal.utils";

const TestFunctionModal = ({ isOpen, onClose, functionCode, parametersSchema }) => {
  const [testParameters, setTestParameters] = useState("{}");
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Generate example parameters based on schema
      const exampleParams = generateExampleParameters(parametersSchema);
      setTestParameters(JSON.stringify(exampleParams, null, 2));
      setTestResult(null);
    }
  }, [isOpen, parametersSchema]);

  const handleTestExecution = async () => {
    setIsExecuting(true);
    setTestResult(null);

    // Validate function code first
    const validation = validateFunctionCode(functionCode);
    if (!validation.valid) {
      setTestResult({
        success: false,
        result: null,
        error: validation.error,
      });
      setIsExecuting(false);
      return;
    }

    // Parse test parameters
    let params;
    try {
      params = JSON.parse(testParameters);
      if (typeof params !== "object" || params === null) {
        throw new Error("Parameters must be a JSON object");
      }
    } catch (error) {
      setTestResult({
        success: false,
        result: null,
        error: `Invalid JSON parameters: ${error.message}`,
      });
      setIsExecuting(false);
      return;
    }

    // Execute the function
    try {
      const result = await executeSandboxedFunction(functionCode, params, 5000);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        result: null,
        error: error.message || String(error),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Modal
      size="md"
      className="test-function-modal"
      open={isOpen}
      modalHeading="Test Function"
      primaryButtonText={isExecuting ? "Running..." : "Run Test"}
      secondaryButtonText="Close"
      onRequestSubmit={handleTestExecution}
      onRequestClose={onClose}
      primaryButtonDisabled={isExecuting}
      preventCloseOnClickOutside
    >
      <div className="margin-bottom-1rem">
        <p className="margin-bottom-1rem">
          Test your function by providing parameter values below.
        </p>

        <FormGroup className="margin-0">
          <label className="cds--label">Test Parameters (JSON object)</label>
          <JsonSchemaEditor
            value={testParameters}
            onChange={(value) => setTestParameters(value)}
            height="150px"
            placeholder='{"param1": "value1", "param2": 123}'
            showValidation={true}
            helperText="Provide parameter values as a JSON object"
          />
        </FormGroup>
      </div>

      {isExecuting && (
        <div className="margin-bottom-1rem">
          <Loading description="Executing function..." withOverlay={false} small />
        </div>
      )}

      {testResult && (
        <div className="margin-top-1rem">
          {testResult.success ? (
            <InlineNotification
              kind="success"
              title="Test Passed"
              subtitle="Function executed successfully"
              lowContrast
              hideCloseButton
            />
          ) : (
            <InlineNotification
              kind="error"
              title="Test Failed"
              subtitle={testResult.error || "Unknown error"}
              lowContrast
              hideCloseButton
            />
          )}

          <div className="margin-top-1rem">
            <label className="cds--label">Result:</label>
            <TextArea
              id="test-result"
              labelText=""
              value={
                testResult.success
                  ? JSON.stringify(testResult.result, null, 2)
                  : testResult.error || "No result"
              }
              rows={6}
              readOnly
            />
          </div>
        </div>
      )}
    </Modal>
  );
};

export default TestFunctionModal;
