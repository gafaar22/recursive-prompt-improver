import React from "react";
import { Loading } from "@carbon/react";
import { useLoading } from "@context/LoadingContext";

const GlobalLoadingOverlay = () => {
  const { isGlobalLoading, globalLoadingMessage } = useLoading();

  if (!isGlobalLoading) return null;

  return (
    <div className="global-loading-overlay">
      <Loading description={globalLoadingMessage} withOverlay={false} />
      {globalLoadingMessage && <p className="global-loading-message">{globalLoadingMessage}</p>}
    </div>
  );
};

export default GlobalLoadingOverlay;
