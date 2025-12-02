import React, { createContext, useContext, useState } from "react";

const ConfirmContext = createContext();

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    body: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: () => {},
    onCancel: () => {},
    variant: "danger", // danger, warning, info, success
  });

  const confirm = ({
    title,
    body,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel = () => {},
    variant = "danger",
  }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        body,
        confirmText,
        cancelText,
        onConfirm: () => {
          if (onConfirm) {
            onConfirm();
          }
          resolve(true);
          handleClose();
        },
        onCancel: () => {
          if (onCancel) {
            onCancel();
          }
          resolve(false);
          handleClose();
        },
        variant,
      });
    });
  };

  const handleClose = () => {
    setConfirmState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  return (
    <ConfirmContext.Provider
      value={{
        ...confirmState,
        confirm,
        handleClose,
      }}
    >
      {children}
    </ConfirmContext.Provider>
  );
};

export default ConfirmContext;
