import React, { createContext, useContext, useState } from "react";
import { Modal, TextInput } from "@carbon/react";
import { SpeechTextArea } from "@components/shared";

const PromptContext = createContext();

export const usePrompt = () => {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error("usePrompt must be used within a PromptProvider");
  }
  return context;
};

export const PromptProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({
    title: "",
    body: "",
    placeholder: "",
    confirmText: "Submit",
    cancelText: "Cancel",
    initialValue: "",
    rows: 4,
    className: "",
    helperText: "",
    validate: null,
  });
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState("");
  const [resolver, setResolver] = useState(null);

  const prompt = ({
    title = "Input Required",
    body = "",
    placeholder = "Enter your text here...",
    confirmText = "Submit",
    cancelText = "Cancel",
    initialValue = "",
    rows = 4,
    className = "",
    helperText = "",
    validate = null,
  }) => {
    return new Promise((resolve) => {
      setConfig({
        title,
        body,
        placeholder,
        confirmText,
        cancelText,
        initialValue,
        rows,
        className,
        helperText,
        validate,
      });
      setInputValue(initialValue);
      setResolver(() => resolve);
      setIsOpen(true);
    });
  };

  const handleInputChange = (value) => {
    setInputValue(value);
    // Real-time validation
    if (config.validate && value.trim()) {
      const error = config.validate(value);
      setValidationError(error || "");
    } else {
      setValidationError("");
    }
  };

  const handleConfirm = () => {
    // Validate before confirming
    if (config.validate) {
      const error = config.validate(inputValue);
      if (error) {
        setValidationError(error);
        return;
      }
    }

    if (resolver) {
      resolver(inputValue);
    }
    setIsOpen(false);
    setInputValue("");
    setValidationError("");
    setResolver(null);
  };

  const handleCancel = () => {
    if (resolver) {
      resolver(null);
    }
    setIsOpen(false);
    setInputValue("");
    setValidationError("");
    setResolver(null);
  };

  return (
    <PromptContext.Provider value={{ prompt }}>
      {children}
      <Modal
        open={isOpen}
        modalHeading={config.title}
        primaryButtonText={config.confirmText}
        secondaryButtonText={config.cancelText}
        onRequestSubmit={handleConfirm}
        onRequestClose={handleCancel}
        primaryButtonDisabled={!inputValue.trim() || !!validationError}
        size="md"
        selectorPrimaryFocus="#prompt-input"
        className={config.className}
        preventCloseOnClickOutside
      >
        {config.body && <p style={{ marginBottom: "1rem" }}>{config.body}</p>}
        {config.rows === 1 ? (
          <TextInput
            id="prompt-input"
            labelText=""
            placeholder={config.placeholder}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            invalid={!!validationError}
            invalidText={validationError}
            helperText={config.helperText}
            autoFocus
          />
        ) : (
          <SpeechTextArea
            id="prompt-input"
            labelText=""
            placeholder={config.placeholder}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            rows={config.rows}
            invalid={!!validationError}
            invalidText={validationError}
            helperText={config.helperText}
            autoFocus
          />
        )}
      </Modal>
    </PromptContext.Provider>
  );
};
