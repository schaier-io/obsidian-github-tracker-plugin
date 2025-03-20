/**
 * Utility function for escaping content in different modes
 * @param unsafe The string to escape
 * @param mode The escaping mode: "disabled", "normal", or "strict"
 * @returns The escaped string
 * @throws Error if input is null or undefined
 */
export function escapeBody(unsafe: string, mode: "disabled" | "normal" | "strict" | "veryStrict" = "normal"): string {
	if (unsafe === null || unsafe === undefined) {
		throw new Error("Input cannot be null or undefined");
	}

	if (mode === "disabled") {
		return unsafe;
	}
	
	if (mode === "strict") {
        //remove all characters that are not a-z, A-Z, 0-9, or whitespace
		return unsafe.replace(/[^a-zA-Z0-9\s.,()/[\]*+-:"#!'?&|*>~^]/g, "").replace(/---/g, "- - -");
	}

    if (mode === "veryStrict") {
        //remove all characters that are not a-z, A-Z, 0-9, or whitespace
		return unsafe.replace(/[^a-zA-Z0-9\s.,?]/g, "");
	}
	
	// normal mode
	return unsafe
		.replace(/<%/g, "'<<'")
		.replace(/%>/g, "'>>'")
		.replace(/`/g, '"')
		.replace(/---/g, "- - -")
        .replace(/{{/g, "((")
        .replace(/}}/g, "))");
} 