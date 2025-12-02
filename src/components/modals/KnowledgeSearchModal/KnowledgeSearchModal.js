import React, { useState, useCallback } from "react";
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  Button,
  TextInput,
  Dropdown,
  InlineLoading,
} from "@carbon/react";
import { Search } from "@carbon/icons-react";
import { RAG } from "@core/RAG";
import { truncateText } from "@utils/uiUtils";

const TOP_K_OPTIONS = [
  { id: 1, text: "1 result" },
  { id: 5, text: "5 results" },
  { id: 10, text: "10 results" },
  { id: 20, text: "20 results" },
  { id: 50, text: "50 results" },
];

const KnowledgeSearchModal = ({ open, onClose, knowledgeBase }) => {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(TOP_K_OPTIONS[1]); // Default to 5
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !knowledgeBase?.vectors) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { modelId, providerId } = knowledgeBase.vectors;

      // Retrieve results from the knowledge base
      const chunks = await RAG.retrieveFromKnowledgeBase(
        query,
        knowledgeBase,
        modelId,
        providerId,
        {
          topK: topK.id,
          minSimilarity: 0.0, // Show all results up to topK
        }
      );

      setResults(chunks);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, topK, knowledgeBase]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && query.trim()) {
      handleSearch();
    }
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    onClose();
  };

  return (
    <ComposedModal open={open} onClose={handleClose} size="lg">
      <ModalHeader title={`Search: ${knowledgeBase?.name || "Knowledge Base"}`} />
      <ModalBody className="knowledge-search-modal">
        <div className="knowledge-search-controls">
          <TextInput
            id="search-query"
            labelText="Search Query"
            placeholder="Enter your search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSearching}
          />
          <Dropdown
            id="top-k-dropdown"
            titleText="Results"
            label="Select number of results"
            items={TOP_K_OPTIONS}
            selectedItem={topK}
            onChange={({ selectedItem }) => setTopK(selectedItem)}
            itemToString={(item) => item?.text || ""}
            disabled={isSearching}
          />
          <Button
            size="md"
            kind="primary"
            renderIcon={Search}
            onClick={handleSearch}
            disabled={!query.trim() || isSearching || !knowledgeBase?.vectors}
            className="knowledge-search-button"
          >
            Search
          </Button>
        </div>

        {isSearching && (
          <div className="knowledge-search-loading">
            <InlineLoading description="Searching..." />
          </div>
        )}

        {!isSearching && hasSearched && (
          <div className="knowledge-search-results">
            <h4 className="knowledge-search-results-title">
              {results.length > 0
                ? `Found ${results.length} result${results.length !== 1 ? "s" : ""}`
                : "No results found"}
            </h4>

            {results.length > 0 && (
              <div className="knowledge-search-results-list">
                {results.map((result, index) => (
                  <div key={`${result.fileId}-${result.index}`} className="knowledge-search-result">
                    <div className="knowledge-search-result-header">
                      <span className="knowledge-search-result-rank">#{index + 1}</span>
                      <span className="knowledge-search-result-file">
                        {truncateText(result.fileName, 40)}
                      </span>
                      <span className="knowledge-search-result-score">
                        {(result.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <div className="knowledge-search-result-text">{result.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!hasSearched && !isSearching && (
          <p className="knowledge-search-hint">
            Enter a query and click Search to find relevant content.
          </p>
        )}
      </ModalBody>
    </ComposedModal>
  );
};

export default KnowledgeSearchModal;
