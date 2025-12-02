/**
 * Infers a JSON schema from a given JSON object
 * @param {any} obj - The JSON object to infer schema from
 * @returns {object} - The inferred JSON schema
 */
export const inferJsonSchema = (obj) => {
  // Handle null
  if (obj === null) {
    return { type: "null" };
  }

  // Handle primitive types
  const typeOf = typeof obj;
  if (typeOf === "boolean") {
    return { type: "boolean" };
  }
  if (typeOf === "number") {
    return Number.isInteger(obj) ? { type: "integer" } : { type: "number" };
  }
  if (typeOf === "string") {
    return { type: "string" };
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return {
        type: "array",
        items: {},
      };
    }

    // Infer schema from first item (simple heuristic)
    // For more complex cases, we could merge schemas from multiple items
    const itemSchema = inferJsonSchema(obj[0]);
    return {
      type: "array",
      items: itemSchema,
    };
  }

  // Handle objects
  if (typeOf === "object") {
    const properties = {};
    const required = [];

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        properties[key] = inferJsonSchema(obj[key]);
        required.push(key);
      }
    }

    const schema = {
      type: "object",
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    return schema;
  }

  // Fallback
  return {};
};

/**
 * Formats a JSON schema with readable indentation
 * @param {object} schema - The JSON schema object
 * @returns {string} - The formatted JSON schema string
 */
export const formatJsonSchema = (schema) => {
  return JSON.stringify(schema, null, 2);
};

/**
 * Attempts to infer a JSON schema from a JSON string
 * @param {string} jsonString - The JSON string to infer schema from
 * @returns {string|null} - The formatted JSON schema string, or null if invalid
 */
export const inferJsonSchemaFromString = (jsonString) => {
  try {
    const obj = JSON.parse(jsonString);
    const schema = inferJsonSchema(obj);
    return formatJsonSchema(schema);
  } catch (e) {
    return null;
  }
};
