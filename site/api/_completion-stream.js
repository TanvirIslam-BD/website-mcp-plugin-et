/**
 * Parsing helpers for OpenAI-style streaming completions.
 *
 * Kept free of database and network imports so they can be unit tested: the
 * tool-call reassembly below is the fiddly part, because one call's name and
 * arguments arrive split across an arbitrary number of chunks.
 */

/** Yields each parsed `data:` payload from an SSE body, skipping keep-alives. */
export async function* completionEvents(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        yield JSON.parse(payload);
      } catch {
        // A partial frame or a provider comment. Skipping beats aborting.
      }
    }
  }
}

/**
 * Accumulates streamed deltas into a single assistant message.
 *
 * Usage: create one, feed it every `choices[0].delta`, then read `message()`.
 */
export function createDeltaAccumulator(onText) {
  let content = "";
  const partials = new Map();

  return {
    push(delta) {
      if (!delta) return;
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onText?.(delta.content);
      }
      for (const fragment of delta.tool_calls || []) {
        const index = Number.isInteger(fragment.index) ? fragment.index : 0;
        const call = partials.get(index) || { id: "", type: "function", function: { name: "", arguments: "" } };
        if (fragment.id) call.id = fragment.id;
        if (fragment.function?.name) call.function.name += fragment.function.name;
        if (fragment.function?.arguments) call.function.arguments += fragment.function.arguments;
        partials.set(index, call);
      }
    },
    get text() {
      return content;
    },
    /** Same shape the non-streaming endpoint returns, so callers stay agnostic. */
    message() {
      // Sorted by index because providers may interleave fragments.
      const toolCalls = [...partials.entries()].sort((a, b) => a[0] - b[0]).map(([, call]) => call);
      return {
        role: "assistant",
        content,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      };
    },
  };
}
