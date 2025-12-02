import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { Modal, Grid, Column, TextInput, NumberInput, Toggle } from "@carbon/react";
import { useHasFormChanges } from "@hooks";

const DEFAULT_MODEL_DATA = {
  id: "",
  text: "",
  contextLength: null,
  supportsTools: true,
  supportsVision: false,
  supportsJsonOutput: true,
};

const CustomModelModal = ({ isOpen, onClose, editingModel, onSave, existingModels = [] }) => {
  const [modelData, setModelData] = useState(DEFAULT_MODEL_DATA);
  const [initialModelData, setInitialModelData] = useState(DEFAULT_MODEL_DATA);
  const [errors, setErrors] = useState({});

  // Reset form when modal opens or editing model changes
  useEffect(() => {
    if (isOpen) {
      if (editingModel) {
        const editData = {
          id: editingModel.id || "",
          text: editingModel.text || "",
          contextLength: editingModel.contextLength || null,
          supportsTools: editingModel.supportsTools ?? true,
          supportsVision: editingModel.supportsVision ?? false,
          supportsJsonOutput: editingModel.supportsJsonOutput ?? true,
        };
        setModelData(editData);
        setInitialModelData(editData);
      } else {
        setModelData(DEFAULT_MODEL_DATA);
        setInitialModelData(DEFAULT_MODEL_DATA);
      }
      setErrors({});
    }
  }, [isOpen, editingModel]);

  // Track form changes
  const hasFormChanges = useHasFormChanges(modelData, initialModelData, {
    editMode: !!editingModel,
  });

  // Check if model is valid (for enabling save button without showing errors)
  const isModelValid = useMemo(() => {
    // Model ID is required
    if (!modelData.id?.trim()) {
      return false;
    }
    // Check for duplicate model ID (excluding current model if editing)
    const isDuplicate = existingModels.some(
      (m) => m.id === modelData.id.trim() && (!editingModel || m.id !== editingModel.id)
    );
    if (isDuplicate) {
      return false;
    }
    // Display name is required
    if (!modelData.text?.trim()) {
      return false;
    }
    // Context length must be valid if provided
    if (modelData.contextLength !== null) {
      if (typeof modelData.contextLength !== "number" || isNaN(modelData.contextLength)) {
        return false;
      }
      if (modelData.contextLength <= 0) {
        return false;
      }
    }
    return true;
  }, [modelData, existingModels, editingModel]);

  const validateForm = () => {
    const newErrors = {};

    // Model ID is required
    if (!modelData.id?.trim()) {
      newErrors.id = "Model ID is required";
    } else {
      // Check for duplicate model ID (excluding current model if editing)
      const isDuplicate = existingModels.some(
        (m) => m.id === modelData.id.trim() && (!editingModel || m.id !== editingModel.id)
      );
      if (isDuplicate) {
        newErrors.id = "A model with this ID already exists";
      }
    }

    // Display name is required
    if (!modelData.text?.trim()) {
      newErrors.text = "Display name is required";
    }

    // Context length must be a valid positive number if provided
    if (modelData.contextLength !== null) {
      if (typeof modelData.contextLength !== "number" || isNaN(modelData.contextLength)) {
        newErrors.contextLength = "Context length must be a valid number";
      } else if (modelData.contextLength <= 0) {
        newErrors.contextLength = "Context length must be a positive number";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const savedModel = {
      ...modelData,
      id: modelData.id.trim(),
      text: modelData.text.trim(),
      isCustom: true, // Mark as custom model
    };

    onSave(savedModel, !!editingModel);
    onClose();
  };

  const handleFieldChange = (field, value) => {
    setModelData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  // Render modal in .rpi container to avoid z-index issues with parent modal
  const portalContainer = document.querySelector(".rpi") || document.body;

  const modalContent = (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading={editingModel ? "Edit Custom Model" : "Add Custom Model"}
      primaryButtonText="Save"
      secondaryButtonText="Cancel"
      onRequestSubmit={handleSave}
      primaryButtonDisabled={!isModelValid || !hasFormChanges}
      size="md"
      preventCloseOnClickOutside
      className="customModelAdd"
      selectorPrimaryFocus="#custom-model-id"
    >
      <Grid style={{ gap: "1rem" }}>
        <Column lg={16} md={8} sm={4}>
          <TextInput
            id="custom-model-id"
            labelText="Model ID *"
            placeholder="e.g., gpt-4-custom or my-local-model"
            helperText="The unique identifier used when calling the API"
            value={modelData.id}
            onChange={(e) => handleFieldChange("id", e.target.value)}
            invalid={!!errors.id}
            invalidText={errors.id}
          />
        </Column>

        <Column lg={16} md={8} sm={4}>
          <TextInput
            id="custom-model-text"
            labelText="Display Name *"
            placeholder="e.g., My Custom GPT-4"
            helperText="Human-readable name shown in model selection"
            value={modelData.text}
            onChange={(e) => handleFieldChange("text", e.target.value)}
            invalid={!!errors.text}
            invalidText={errors.text}
          />
        </Column>

        <Column lg={16} md={8} sm={4}>
          <NumberInput
            id="custom-model-context-length"
            label="Context Length (tokens)"
            helperText="Maximum number of tokens the model can process (leave empty if unknown)"
            value={modelData.contextLength || ""}
            onChange={(e, { value }) => handleFieldChange("contextLength", value || null)}
            min={1}
            step={1024}
            allowEmpty
            hideSteppers={false}
            invalid={!!errors.contextLength}
            invalidText={errors.contextLength}
          />
        </Column>

        <Column lg={5} md={3} sm={4}>
          <Toggle
            id="custom-model-supports-tools"
            labelText="Supports Tools"
            labelA="No"
            labelB="Yes"
            toggled={modelData.supportsTools}
            onToggle={(checked) => handleFieldChange("supportsTools", checked)}
          />
        </Column>

        <Column lg={5} md={3} sm={4}>
          <Toggle
            id="custom-model-supports-vision"
            labelText="Supports Vision"
            labelA="No"
            labelB="Yes"
            toggled={modelData.supportsVision}
            onToggle={(checked) => handleFieldChange("supportsVision", checked)}
          />
        </Column>

        <Column lg={6} md={2} sm={4}>
          <Toggle
            id="custom-model-supports-json"
            labelText="JSON Output"
            labelA="No"
            labelB="Yes"
            toggled={modelData.supportsJsonOutput}
            onToggle={(checked) => handleFieldChange("supportsJsonOutput", checked)}
          />
        </Column>
      </Grid>
    </Modal>
  );

  return ReactDOM.createPortal(modalContent, portalContainer);
};

export default CustomModelModal;
