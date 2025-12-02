import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";

const KnowledgeContext = createContext();

export const KnowledgeProvider = ({ children }) => {
  // Ingestion state - track which KBs are being indexed
  const [indexingKBs, setIndexingKBs] = useState(new Set());
  const [indexingProgress, setIndexingProgress] = useState({});

  // PDF processing state - track which KBs are processing PDFs
  const [processingKBs, setProcessingKBs] = useState(new Set());
  const [processingProgress, setProcessingProgress] = useState({});

  // Abort controllers for each indexing KB
  const abortControllersRef = useRef({});

  // Start indexing a knowledge base - returns abort controller
  const startIndexing = useCallback((knowledgeBaseId) => {
    const controller = new AbortController();
    abortControllersRef.current[knowledgeBaseId] = controller;
    setIndexingKBs((prev) => new Set([...prev, knowledgeBaseId]));
    setIndexingProgress((prev) => ({ ...prev, [knowledgeBaseId]: "Starting..." }));
    return controller;
  }, []);

  // Update indexing progress
  const updateIndexingProgress = useCallback((knowledgeBaseId, progress) => {
    setIndexingProgress((prev) => ({ ...prev, [knowledgeBaseId]: progress }));
  }, []);

  // Stop indexing a knowledge base
  const stopIndexing = useCallback((knowledgeBaseId) => {
    // Clean up abort controller
    delete abortControllersRef.current[knowledgeBaseId];
    setIndexingKBs((prev) => {
      const next = new Set(prev);
      next.delete(knowledgeBaseId);
      return next;
    });
    setIndexingProgress((prev) => {
      const next = { ...prev };
      delete next[knowledgeBaseId];
      return next;
    });
  }, []);

  // Abort indexing for a specific knowledge base
  const abortIndexing = useCallback((knowledgeBaseId) => {
    const controller = abortControllersRef.current[knowledgeBaseId];
    if (controller) {
      controller.abort();
    }
  }, []);

  // Abort all indexing operations
  const abortAllIndexing = useCallback(() => {
    Object.values(abortControllersRef.current).forEach((controller) => {
      controller.abort();
    });
  }, []);

  // Start processing PDFs for a knowledge base
  const startProcessing = useCallback((knowledgeBaseId, total = 1) => {
    setProcessingKBs((prev) => new Set([...prev, knowledgeBaseId]));
    setProcessingProgress((prev) => ({
      ...prev,
      [knowledgeBaseId]: { current: 0, total, fileName: "", page: 0, totalPages: 0 },
    }));
  }, []);

  // Update processing progress
  const updateProcessingProgress = useCallback((knowledgeBaseId, progress) => {
    setProcessingProgress((prev) => ({
      ...prev,
      [knowledgeBaseId]: { ...prev[knowledgeBaseId], ...progress },
    }));
  }, []);

  // Stop processing PDFs for a knowledge base
  const stopProcessing = useCallback((knowledgeBaseId) => {
    setProcessingKBs((prev) => {
      const next = new Set(prev);
      next.delete(knowledgeBaseId);
      return next;
    });
    setProcessingProgress((prev) => {
      const next = { ...prev };
      delete next[knowledgeBaseId];
      return next;
    });
  }, []);

  // Check if a knowledge base is busy (indexing or processing)
  const isKBBusy = useCallback(
    (knowledgeBaseId) => {
      return indexingKBs.has(knowledgeBaseId) || processingKBs.has(knowledgeBaseId);
    },
    [indexingKBs, processingKBs]
  );

  // Check if any KB is currently indexing or processing
  const isAnyIndexing = indexingKBs.size > 0 || processingKBs.size > 0;

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      // Indexing state
      indexingKBs,
      indexingProgress,
      startIndexing,
      updateIndexingProgress,
      stopIndexing,
      abortIndexing,
      abortAllIndexing,
      // Processing state
      processingKBs,
      processingProgress,
      startProcessing,
      updateProcessingProgress,
      stopProcessing,
      // Helpers
      isKBBusy,
      isAnyIndexing,
    }),
    [
      indexingKBs,
      indexingProgress,
      startIndexing,
      updateIndexingProgress,
      stopIndexing,
      abortIndexing,
      abortAllIndexing,
      processingKBs,
      processingProgress,
      startProcessing,
      updateProcessingProgress,
      stopProcessing,
      isKBBusy,
      isAnyIndexing,
    ]
  );

  return <KnowledgeContext.Provider value={contextValue}>{children}</KnowledgeContext.Provider>;
};

export const useKnowledge = () => {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error("useKnowledge must be used within a KnowledgeProvider");
  }
  return context;
};
