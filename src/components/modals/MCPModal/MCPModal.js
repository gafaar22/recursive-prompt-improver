import React, { useState, useEffect } from "react";
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  TextInput,
  FormGroup,
  Button,
  InlineLoading,
} from "@carbon/react";
import { saveMCPServer, loadMCPServers } from "@utils/storageUtils";
import { useToast } from "@context/ToastContext";
import { useSettings } from "@context/SettingsContext";
import { useHasFormChanges } from "@hooks";
import * as MCP from "@core/MCP";
import CodeEditor from "@components/shared/CodeEditor";
import { Connect } from "@carbon/icons-react";

const MCPModal = ({ isOpen, onClose, editMode = false, initialServer = null, onSave }) => {
  const { showError, showSuccess } = useToast();
  const { settings } = useSettings();

  const [currentServer, setCurrentServer] = useState(
    initialServer || {
      name: "",
      url: "",
      headers: "{}",
    }
  );

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [hasTestedSuccessfully, setHasTestedSuccessfully] = useState(false);

  // Reset form when modal opens with new server
  useEffect(() => {
    if (initialServer) {
      setCurrentServer({
        ...initialServer,
        headers:
          typeof initialServer.headers === "string"
            ? initialServer.headers
            : JSON.stringify(initialServer.headers || {}, null, 2),
      });
      setHasTestedSuccessfully(false);
      setTestResult(null);
    } else {
      setCurrentServer({
        name: "",
        url: "",
        headers: "{}",
      });
      setHasTestedSuccessfully(false);
      setTestResult(null);
    }
  }, [initialServer, isOpen]);

  // Track form changes
  const hasChanges = useHasFormChanges(currentServer, initialServer);

  // Validate form
  const isFormValid = () => {
    if (!currentServer.name.trim()) {
      return false;
    }
    if (!currentServer.url.trim()) {
      return false;
    }
    // Validate headers JSON
    try {
      JSON.parse(currentServer.headers);
    } catch (e) {
      return false;
    }
    return true;
  };

  // Handle field changes
  const handleChange = (field, value) => {
    setCurrentServer((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Reset test result when connection params change
    if (field === "url" || field === "headers") {
      setHasTestedSuccessfully(false);
      setTestResult(null);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!currentServer.url.trim()) {
      showError("Validation Error", "URL is required");
      return;
    }

    let headers = {};
    try {
      headers = JSON.parse(currentServer.headers);
    } catch (e) {
      showError("Validation Error", "Headers must be valid JSON");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await MCP.testConnection({
        url: currentServer.url,
        headers,
      });

      setTestResult(result);
      setHasTestedSuccessfully(result.success);

      if (result.success) {
        showSuccess(
          "Connection successful",
          `Connected to MCP server. Found ${result.toolCount} tools.`
        );
      } else {
        showError("Connection failed", result.error);
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      setTestResult({
        success: false,
        error: error.message || "Connection test failed",
      });
      setHasTestedSuccessfully(false);
      showError("Connection test failed", error.message);
    } finally {
      setIsTesting(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!isFormValid()) {
      showError("Validation Error", "Please fill in all required fields with valid values");
      return;
    }

    // if (!hasTestedSuccessfully && !editMode) {
    //   showError("Connection not tested", "Please test the connection successfully before saving");
    //   return;
    // }

    try {
      // Check for duplicate server name
      const existingServers = await loadMCPServers();
      const isDuplicate = existingServers.some(
        (server) =>
          server.name.toLowerCase() === currentServer.name.trim().toLowerCase() &&
          server.id !== currentServer.id
      );

      if (isDuplicate) {
        showError(
          "Duplicate server name",
          "An MCP server with this name already exists. Please choose a different name."
        );
        return;
      }

      let headers = {};
      try {
        headers = JSON.parse(currentServer.headers);
      } catch (e) {
        showError("Validation Error", "Headers must be valid JSON");
        return;
      }

      const serverToSave = {
        id: currentServer.id,
        name: currentServer.name.trim(),
        url: currentServer.url.trim(),
        headers,
        status: hasTestedSuccessfully ? "connected" : "disconnected",
        toolCount: testResult?.toolCount || 0,
        lastError: testResult?.error || null,
      };

      const updatedServers = await saveMCPServer(serverToSave);
      onSave(updatedServers);
      handleClose();
    } catch (error) {
      console.error("Error saving MCP server:", error);
      showError("Save failed", error.message);
    }
  };

  // Handle close
  const handleClose = () => {
    setCurrentServer({
      name: "",
      url: "",
      headers: "{}",
    });
    setTestResult(null);
    setHasTestedSuccessfully(false);
    onClose();
  };

  return (
    <ComposedModal
      size="lg"
      open={isOpen}
      onClose={handleClose}
      preventCloseOnClickOutside={hasChanges}
    >
      <ModalHeader title={editMode ? "Edit MCP Server" : "New MCP Server"} />
      <ModalBody hasForm>
        <Form>
          <FormGroup legendText="">
            <TextInput
              id="mcp-name"
              labelText={"Name (*)"}
              placeholder="My MCP Server"
              value={currentServer.name}
              onChange={(e) => handleChange("name", e.target.value)}
              invalid={!currentServer.name.trim() && currentServer.name !== ""}
              invalidText="Name is required"
              helperText="Must be unique"
            />
          </FormGroup>

          <FormGroup legendText="" className="margin-top-1rem">
            <label className="cds--label">Server URL (*)</label>
            <div className="code-editor-wrapper">
              <CodeEditor
                value={currentServer.url}
                onChange={(value) => handleChange("url", value)}
                height="32px"
                showLineNumbers={false}
                envVariables={settings.environmentVariables}
              />
            </div>
            <div className="cds--form__helper-text">
              You can use environment variables like env.VAR_NAME
            </div>
          </FormGroup>
          <FormGroup legendText="Headers (JSON)" className="margin-top-1rem">
            <div className="code-editor-wrapper">
              <CodeEditor
                value={currentServer.headers}
                onChange={(value) => handleChange("headers", value)}
                language="json"
                placeholder='{"Authorization": "env.API_KEY"}'
                height="150px"
                envVariables={settings.environmentVariables}
              />
            </div>
            <div className="cds--form__helper-text">
              Optional headers as valid JSON. Use env.VAR_NAME inside quoted strings, e.g.{" "}
              {`{"Authorization": "Bearer env.API_KEY"}`}
            </div>
          </FormGroup>

          <FormGroup legendText="">
            <div className="flex-center" style={{ gap: "1rem", marginTop: "1rem" }}>
              <Button
                size="sm"
                kind="tertiary"
                renderIcon={Connect}
                onClick={handleTestConnection}
                disabled={isTesting || !currentServer.url.trim()}
              >
                {isTesting ? "Testing..." : "Test Connection"}
              </Button>
              {isTesting && <InlineLoading description="Testing connection..." />}
              {testResult && !isTesting && (
                <>
                  {testResult.success ? (
                    <InlineLoading
                      status="finished"
                      description={`Connected (${testResult.toolCount} tools)`}
                    />
                  ) : (
                    <InlineLoading status="error" description={testResult.error} />
                  )}
                </>
              )}
            </div>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter
        primaryButtonText={editMode ? "Update" : "Create"}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSave}
        onRequestClose={handleClose}
        primaryButtonDisabled={!isFormValid()} // || (!hasTestedSuccessfully && !editMode)}
      />
    </ComposedModal>
  );
};

export default MCPModal;
