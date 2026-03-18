import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryPlayerRepository } from "../src/playerRepository.js";

describe("InMemoryPlayerRepository", () => {
  it("registers a new player and returns an id", async () => {
    const repo = new InMemoryPlayerRepository();
    const result = await repo.register("Jane Smith", "jane@example.com", "555-1234");
    assert.ok(result.id);
    assert.equal(result.existing, false);
  });

  it("returns existing player on duplicate email", async () => {
    const repo = new InMemoryPlayerRepository();
    const first = await repo.register("Jane Smith", "jane@example.com");
    const second = await repo.register("Jane Smith", "JANE@EXAMPLE.COM");
    assert.equal(second.id, first.id);
    assert.equal(second.existing, true);
  });

  it("stores phone as null when omitted", async () => {
    const repo = new InMemoryPlayerRepository();
    const result = await repo.register("Jane Smith", "jane@example.com");
    const record = await repo.getById(result.id);
    assert.equal(record?.phone, null);
  });

  it("retrieves player by id", async () => {
    const repo = new InMemoryPlayerRepository();
    const result = await repo.register("Jane Smith", "jane@example.com", "555-1234");
    const record = await repo.getById(result.id);
    assert.equal(record?.fullName, "Jane Smith");
    assert.equal(record?.email, "jane@example.com");
    assert.equal(record?.phone, "555-1234");
    assert.ok(record?.registeredAt);
  });

  it("retrieves player by email (case-insensitive)", async () => {
    const repo = new InMemoryPlayerRepository();
    await repo.register("Jane Smith", "Jane@Example.com");
    const record = await repo.getByEmail("jane@example.com");
    assert.equal(record?.fullName, "Jane Smith");
  });

  it("returns null for unknown id", async () => {
    const repo = new InMemoryPlayerRepository();
    const record = await repo.getById("nonexistent");
    assert.equal(record, null);
  });

  it("returns null for unknown email", async () => {
    const repo = new InMemoryPlayerRepository();
    const record = await repo.getByEmail("nobody@example.com");
    assert.equal(record, null);
  });

  it("getAll returns all registered players", async () => {
    const repo = new InMemoryPlayerRepository();
    await repo.register("Alice", "alice@example.com");
    await repo.register("Bob", "bob@example.com");
    await repo.register("Charlie", "charlie@example.com");
    const all = await repo.getAll();
    assert.equal(all.length, 3);
    const names = all.map((p) => p.fullName).sort();
    assert.deepEqual(names, ["Alice", "Bob", "Charlie"]);
  });

  it("getAll returns empty array when no players", async () => {
    const repo = new InMemoryPlayerRepository();
    const all = await repo.getAll();
    assert.equal(all.length, 0);
  });
});

describe("CSV export escaping", () => {
  const csvEscape = (field: string) => {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  it("escapes fields with commas", () => {
    assert.equal(csvEscape("Smith, Jane"), '"Smith, Jane"');
  });

  it("escapes fields with double quotes", () => {
    assert.equal(csvEscape('He said "hello"'), '"He said ""hello"""');
  });

  it("escapes fields with newlines", () => {
    assert.equal(csvEscape("line1\nline2"), '"line1\nline2"');
  });

  it("does not escape plain fields", () => {
    assert.equal(csvEscape("Jane Smith"), "Jane Smith");
  });
});
