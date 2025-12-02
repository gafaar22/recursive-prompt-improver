export const validateToolName = (name) => {
  // Check length: 1 ≤ length ≤ 64
  if (name.length < 1 || name.length > 64) {
    return "Tool name must be between 1 and 64 characters";
  }

  // Check regex: ^[a-zA-Z]+[a-zA-Z0-9-_]*$
  const nameRegex = /^[a-zA-Z]+[a-zA-Z0-9-_]*$/;
  if (!nameRegex.test(name)) {
    return "Tool name must start with a letter and contain only letters, numbers, hyphens, and underscores";
  }

  return null;
};

// Check if JSON is valid
export const isValidJson = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};
