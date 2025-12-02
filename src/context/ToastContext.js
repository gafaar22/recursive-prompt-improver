import React, { createContext, useContext, useState } from "react";
import { ToastNotification } from "@carbon/react";
import { useNavigate } from "react-router-dom";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now();
    setToasts((prevToasts) => [...prevToasts, { ...toast, id }]);

    // Auto-dismiss after timeout if specified
    if (toast.timeout) {
      setTimeout(() => {
        removeToast(id);
      }, toast.timeout);
    }
  };

  const removeToast = (id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };

  const showSuccess = (title, subtitle = "", timeout = 5000, linkTo = null, linkText = null) => {
    addToast({
      kind: "success",
      title,
      subtitle,
      timeout,
      linkTo,
      linkText,
    });
  };

  const showError = (title, subtitle = "", timeout = 8000, linkTo = null, linkText = null) => {
    addToast({
      kind: "error",
      title,
      subtitle,
      timeout,
      linkTo,
      linkText,
    });
  };

  const showWarning = (title, subtitle = "", timeout = 5000, linkTo = null, linkText = null) => {
    addToast({
      kind: "warning",
      title,
      subtitle,
      timeout,
      linkTo,
      linkText,
    });
  };

  const showInfo = (title, subtitle = "", timeout = 2000, linkTo = null, linkText = null) => {
    addToast({
      kind: "info",
      title,
      subtitle,
      timeout,
      linkTo,
      linkText,
    });
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
      <div className="toastContainer">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={toast.linkTo ? "dynamic-cursor" : "cursor-default"}
            onClick={() => {
              if (toast.linkTo) {
                navigate(toast.linkTo);
              }
            }}
          >
            <ToastNotification
              lowContrast={true}
              kind={toast.kind}
              title={toast.title}
              subtitle={toast.subtitle}
              caption={toast.caption}
              timeout={false} // We handle timeout ourselves
              onClose={(e) => {
                e.stopPropagation(); // Prevent navigation when clicking close button
                removeToast(toast.id);
              }}
              className="min-width-300px"
            >
              {toast.linkTo && (
                <span className="toast-link">
                  {toast.linkText ? `${toast.linkText}` : "Click here to view"}
                </span>
              )}
            </ToastNotification>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastContext;
