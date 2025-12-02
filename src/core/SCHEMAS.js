const SCORE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ScoreResult",
  type: "object",
  properties: {
    scores: {
      type: "object",
      properties: {
        format: {
          type: "integer",
          // minimum: 1,
          // maximum: 100,
        },
        accuracy: {
          type: "integer",
          // minimum: 1,
          // maximum: 100,
        },
        completeness: {
          type: "integer",
          // minimum: 1,
          // maximum: 100,
        },
        meaning: {
          type: "integer",
          // minimum: 1,
          // maximum: 100,
        },
      },
      required: ["format", "accuracy", "completeness", "meaning"],
      additionalProperties: false,
    },
    final_score: {
      type: "integer",
      // minimum: 1,
      // maximum: 100,
    },
  },
  required: ["scores", "final_score"],
  additionalProperties: false,
};

const FEEDBACK_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "FeedbackResult",
  type: "object",
  properties: {
    feedback: {
      type: "string",
      description: "Concise general fix instructions describing all required changes.",
    },
  },
  required: ["feedback"],
  additionalProperties: false,
};

const IMPROVER_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ImprovedPrompt",
  type: "object",
  properties: {
    improvedPrompt: {
      type: "string",
      description: "Final improved System Prompt",
    },
    summary: {
      type: "string",
      description: "Short description of the prompt",
    },
  },
  required: ["improvedPrompt", "summary"],
  additionalProperties: false,
};

export { SCORE_SCHEMA, FEEDBACK_SCHEMA, IMPROVER_SCHEMA };
