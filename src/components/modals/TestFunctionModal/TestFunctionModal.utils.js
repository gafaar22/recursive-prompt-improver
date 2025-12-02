// Generate example parameters from schema
export const generateExampleParameters = (schema) => {
  if (!schema || !schema.properties) {
    return {};
  }

  const example = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.type === "string") {
      example[key] = prop.default || `example_${key}`;
    } else if (prop.type === "number" || prop.type === "integer") {
      example[key] = prop.default || 42;
    } else if (prop.type === "boolean") {
      example[key] = prop.default !== undefined ? prop.default : true;
    } else if (prop.type === "array") {
      example[key] = prop.default || [];
    } else if (prop.type === "object") {
      example[key] = prop.default || {};
    } else {
      example[key] = null;
    }
  }
  return example;
};
