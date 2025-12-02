import React from "react";
import { Modal } from "@carbon/react";
import ReactDiffViewer from "@alexbruf/react-diff-viewer";
import "@alexbruf/react-diff-viewer/index.css";

const DiffModal = ({
  isOpen,
  onClose,
  title = "Diff Viewer",
  oldValue = "",
  newValue = "",
  //   oldLabel = "Original",
  //   newLabel = "Modified",
  showDiffOnly = false,
  hideLineNumbers = true,
  useDarkTheme = true,
  splitView = false,
  compareMethod = "diffWords",
}) => {
  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      passiveModal
      modalHeading={title}
      size="lg"
      preventCloseOnClickOutside
    >
      <div style={{ marginTop: "1rem" }}>
        <ReactDiffViewer
          showDiffOnly={showDiffOnly}
          hideLineNumbers={hideLineNumbers}
          useDarkTheme={useDarkTheme}
          oldValue={oldValue}
          newValue={newValue}
          //   leftTitle={oldLabel}
          //   rightTitle={newLabel}
          splitView={splitView}
          compareMethod={compareMethod}
        />
      </div>
    </Modal>
  );
};

export default DiffModal;
