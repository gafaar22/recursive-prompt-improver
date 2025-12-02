import React from "react";
import { Modal } from "@carbon/react";
import { useConfirm } from "@context/ConfirmContext";

const ConfirmModal = () => {
  const { isOpen, title, body, confirmText, cancelText, onConfirm, onCancel, variant } =
    useConfirm();

  return (
    <Modal
      open={isOpen}
      modalHeading={title}
      primaryButtonText={confirmText}
      secondaryButtonText={cancelText}
      onRequestSubmit={onConfirm}
      onRequestClose={onCancel}
      onSecondarySubmit={onCancel}
      danger={variant === "danger"}
      primaryButtonDisabled={false}
      size="sm"
      preventCloseOnClickOutside
    >
      <div className="margin-1rem-0">{typeof body === "string" ? <p>{body}</p> : body}</div>
    </Modal>
  );
};

export default ConfirmModal;
