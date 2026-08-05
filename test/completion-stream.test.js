import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Readable } from "node:stream";
import { completionEvents, createDeltaAccumulator } from "../site/api/_completion-stream.js";

/** Feeds the parser exactly the byte boundaries a provider might use. */
function body(...chunks) {
  return Readable.from(chunks.map((c) => Buffer.from(c, "utf8")));
}

async function collect(stream) {
  const events = [];
  for await (const event of completionEvents(stream)) events.push(event);
  return events;
}

describe("completionEvents", () => {
  it("parses one event per data line", async () => {
    const events = await collect(body(
      'data: {"a":1}\n\n',
      'data: {"a":2}\n\n',
    ));
    assert.deepEqual(events, [{ a: 1 }, { a: 2 }]);
  });

  it("stops at [DONE] and ignores anything after it", async () => {
    const events = await collect(body('data: {"a":1}\n\ndata: [DONE]\n\ndata: {"a":2}\n\n'));
    assert.deepEqual(events, [{ a: 1 }]);
  });

  it("skips keep-alive comments and blank lines", async () => {
    const events = await collect(body(': open\n\n\n', 'data: {"a":1}\n\n', ':ping\n\n'));
    assert.deepEqual(events, [{ a: 1 }]);
  });

  it("reassembles an event split across chunk boundaries mid-JSON", async () => {
    const events = await collect(body('data: {"text":"hel', 'lo world"}\n\n'));
    assert.deepEqual(events, [{ text: "hello world" }]);
  });

  it("survives a chunk boundary inside a multi-byte character", async () => {
    const taka = Buffer.from("৳", "utf8");
    const events = await collect(Readable.from([
      Buffer.from('data: {"text":"', "utf8"),
      taka.subarray(0, 1),
      taka.subarray(1),
      Buffer.from('"}\n\n', "utf8"),
    ]));
    assert.deepEqual(events, [{ text: "৳" }]);
  });

  it("drops an unparseable frame without aborting the rest", async () => {
    const events = await collect(body('data: {broken\n\n', 'data: {"a":1}\n\n'));
    assert.deepEqual(events, [{ a: 1 }]);
  });

  it("returns nothing for an empty body", async () => {
    assert.deepEqual(await collect(body()), []);
  });
});

describe("createDeltaAccumulator", () => {
  it("concatenates text and reports it to the callback as it arrives", () => {
    const seen = [];
    const acc = createDeltaAccumulator((t) => seen.push(t));
    acc.push({ content: "Hel" });
    acc.push({ content: "lo" });
    assert.equal(acc.text, "Hello");
    assert.deepEqual(seen, ["Hel", "lo"]);
    assert.equal(acc.message().content, "Hello");
    assert.equal(acc.message().tool_calls, undefined);
  });

  it("reassembles a tool call whose name and arguments arrive in fragments", () => {
    const acc = createDeltaAccumulator();
    acc.push({ tool_calls: [{ index: 0, id: "call_1", function: { name: "add_" } }] });
    acc.push({ tool_calls: [{ index: 0, function: { name: "expense" } }] });
    acc.push({ tool_calls: [{ index: 0, function: { arguments: '{"amo' } }] });
    acc.push({ tool_calls: [{ index: 0, function: { arguments: 'unt":500}' } }] });

    const [call] = acc.message().tool_calls;
    assert.equal(call.id, "call_1");
    assert.equal(call.function.name, "add_expense");
    assert.deepEqual(JSON.parse(call.function.arguments), { amount: 500 });
  });

  it("keeps parallel tool calls separate and ordered by index", () => {
    const acc = createDeltaAccumulator();
    acc.push({ tool_calls: [{ index: 1, id: "b", function: { name: "second", arguments: "{}" } }] });
    acc.push({ tool_calls: [{ index: 0, id: "a", function: { name: "first", arguments: "{}" } }] });
    acc.push({ tool_calls: [{ index: 1, function: { arguments: "" } }] });

    const calls = acc.message().tool_calls;
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((c) => c.id), ["a", "b"]);
    assert.deepEqual(calls.map((c) => c.function.name), ["first", "second"]);
  });

  it("defaults a missing index to 0 rather than dropping the fragment", () => {
    const acc = createDeltaAccumulator();
    acc.push({ tool_calls: [{ id: "x", function: { name: "tool", arguments: "{}" } }] });
    assert.equal(acc.message().tool_calls.length, 1);
    assert.equal(acc.message().tool_calls[0].function.name, "tool");
  });

  it("tolerates empty, null and contentless deltas", () => {
    const acc = createDeltaAccumulator();
    acc.push(undefined);
    acc.push(null);
    acc.push({});
    acc.push({ content: "" });
    acc.push({ role: "assistant" });
    assert.equal(acc.text, "");
    assert.equal(acc.message().tool_calls, undefined);
  });

  it("produces a message shaped like the non-streaming response", () => {
    const acc = createDeltaAccumulator();
    acc.push({ content: "hi" });
    const message = acc.message();
    assert.equal(message.role, "assistant");
    assert.equal(typeof message.content, "string");
  });
});
