// Helper function to parse and format tool arguments
export const parseToolArguments = (args) => {
  if (!args) return "No arguments";

  // If already an object, just stringify it
  if (typeof args !== "string") {
    return JSON.stringify(args, null, 2);
  }

  // Try to parse the string (handle double-encoding)
  try {
    let parsed = JSON.parse(args);
    // Check if it's still a string after first parse (double-encoded)
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // If parsing fails, return as-is
    return args;
  }
};
