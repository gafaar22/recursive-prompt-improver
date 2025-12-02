import { useState, useCallback } from "react";

/**
 * Custom hook for managing modal state with create/edit modes
 *
 * @returns {Object} Modal state and control functions
 * @property {boolean} isOpen - Whether the modal is open
 * @property {any} currentItem - The current item being edited (null for create mode)
 * @property {boolean} editMode - Whether in edit mode (true) or create mode (false)
 * @property {Function} openCreate - Opens modal in create mode
 * @property {Function} openEdit - Opens modal in edit mode with an item
 * @property {Function} close - Closes modal and resets state
 *
 * @example
 * const { isOpen, currentItem, editMode, openCreate, openEdit, close } = useModalState();
 *
 * // Open for creating new item
 * <Button onClick={openCreate}>Create New</Button>
 *
 * // Open for editing existing item
 * <Button onClick={() => openEdit(item)}>Edit</Button>
 *
 * // Use in modal
 * <Modal open={isOpen} onClose={close}>
 *   {editMode ? "Edit Item" : "Create Item"}
 * </Modal>
 */
export const useModalState = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const openCreate = useCallback(() => {
    setCurrentItem(null);
    setEditMode(false);
    setIsOpen(true);
  }, []);

  const openEdit = useCallback((item) => {
    setCurrentItem(item);
    setEditMode(true);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setCurrentItem(null);
    setEditMode(false);
  }, []);

  return {
    isOpen,
    currentItem,
    editMode,
    openCreate,
    openEdit,
    close,
  };
};
