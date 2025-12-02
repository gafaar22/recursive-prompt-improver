import React from "react";
import { Column, Button } from "@carbon/react";
import { Add } from "@carbon/react/icons";
import TestPairComponent from "./TestPairComponent";
import { MAX_NUM_TESTS } from "@utils/constants";

const TestPairsSection = ({
  inOutPairs,
  isLoading,
  isImprovingPrompt,
  fillingOutputIndex,
  testPairRowFocused,
  onInputChange,
  onOutputChange,
  onInputFocus,
  onInputBlur,
  onOutputFocus,
  onOutputBlur,
  onSettingsClick,
  onFillOutput,
  onDuplicate,
  onRemove,
  onRemoveCheckType,
  onRemoveJsonSchema,
  onRemoveContext,
  onRemoveKnowledgeBases,
  onRemoveImages,
  onRemoveModel,
  onAddPair,
  getLastSessionScoreByTestIndex,
}) => {
  return (
    <>
      {inOutPairs.map((pair, index) => (
        <TestPairComponent
          key={index}
          pair={pair}
          index={index}
          isLoading={isLoading}
          isImprovingPrompt={isImprovingPrompt}
          isFillingOutput={fillingOutputIndex === index}
          testPairRowFocused={testPairRowFocused}
          totalPairs={inOutPairs.length}
          lastSessionScore={getLastSessionScoreByTestIndex(index)}
          onInputChange={(idx, value) => onInputChange(idx, value)}
          onOutputChange={(idx, value) => onOutputChange(idx, value)}
          onInputFocus={onInputFocus}
          onInputBlur={onInputBlur}
          onOutputFocus={onOutputFocus}
          onOutputBlur={onOutputBlur}
          onSettingsClick={(idx) => onSettingsClick(idx)}
          onFillOutput={onFillOutput}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onRemoveCheckType={(idx, checkTypeId) => onRemoveCheckType(idx, checkTypeId)}
          onRemoveJsonSchema={(idx) => onRemoveJsonSchema(idx)}
          onRemoveContext={(idx) => onRemoveContext(idx)}
          onRemoveKnowledgeBases={(idx) => onRemoveKnowledgeBases(idx)}
          onRemoveImages={(idx) => onRemoveImages(idx)}
          onRemoveModel={(idx) => onRemoveModel(idx)}
        />
      ))}
      <Column lg={16} md={8} sm={4} className="addContainer">
        <Button
          kind="ghost"
          size="sm"
          onClick={onAddPair}
          disabled={isLoading || inOutPairs.length >= MAX_NUM_TESTS}
          renderIcon={Add}
        >
          Add Test
        </Button>
      </Column>
    </>
  );
};

export default TestPairsSection;
