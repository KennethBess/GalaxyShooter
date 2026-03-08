import assert from "node:assert/strict";
import test from "node:test";
import { loadBackendConfig } from "../src/config.js";

test("loadBackendConfig uses defaults when env vars are absent", () => {
  const saved = { ...process.env };
  delete process.env.REDIS_URL;
  delete process.env.INSTANCE_ID;
  delete process.env.ROOM_STATE_TTL_SECONDS;
  delete process.env.ROOM_OWNER_TTL_SECONDS;
  delete process.env.WEB_PUBSUB_CONNECTION_STRING;
  delete process.env.WEB_PUBSUB_HUB;

  try {
    const config = loadBackendConfig();
    assert.equal(config.redisUrl, undefined);
    assert.ok(config.instanceId.length > 0);
    assert.equal(config.roomStateTtlSeconds, 3600);
    assert.equal(config.roomOwnerTtlSeconds, 3600);
    assert.equal(config.webPubSubConnectionString, undefined);
    assert.equal(config.webPubSubHub, "galaxyshooter");
  } finally {
    Object.assign(process.env, saved);
  }
});

test("loadBackendConfig parses valid TTL numbers", () => {
  const saved = { ...process.env };
  process.env.ROOM_STATE_TTL_SECONDS = "7200";
  process.env.ROOM_OWNER_TTL_SECONDS = "300";

  try {
    const config = loadBackendConfig();
    assert.equal(config.roomStateTtlSeconds, 7200);
    assert.equal(config.roomOwnerTtlSeconds, 300);
  } finally {
    Object.assign(process.env, saved);
  }
});

test("loadBackendConfig falls back on non-numeric TTL values", () => {
  const saved = { ...process.env };
  process.env.ROOM_STATE_TTL_SECONDS = "not-a-number";
  process.env.ROOM_OWNER_TTL_SECONDS = "";

  try {
    const config = loadBackendConfig();
    assert.equal(config.roomStateTtlSeconds, 3600);
    assert.equal(config.roomOwnerTtlSeconds, 3600);
  } finally {
    Object.assign(process.env, saved);
  }
});

test("loadBackendConfig falls back on zero and negative TTL values", () => {
  const saved = { ...process.env };
  process.env.ROOM_STATE_TTL_SECONDS = "0";
  process.env.ROOM_OWNER_TTL_SECONDS = "-5";

  try {
    const config = loadBackendConfig();
    assert.equal(config.roomStateTtlSeconds, 3600);
    assert.equal(config.roomOwnerTtlSeconds, 3600);
  } finally {
    Object.assign(process.env, saved);
  }
});

test("loadBackendConfig falls back on Infinity and NaN TTL values", () => {
  const saved = { ...process.env };
  process.env.ROOM_STATE_TTL_SECONDS = "Infinity";
  process.env.ROOM_OWNER_TTL_SECONDS = "NaN";

  try {
    const config = loadBackendConfig();
    assert.equal(config.roomStateTtlSeconds, 3600);
    assert.equal(config.roomOwnerTtlSeconds, 3600);
  } finally {
    Object.assign(process.env, saved);
  }
});

test("loadBackendConfig trims whitespace from string values", () => {
  const saved = { ...process.env };
  process.env.REDIS_URL = "  redis://localhost:6379  ";
  process.env.INSTANCE_ID = "  my-instance  ";
  process.env.WEB_PUBSUB_HUB = "  myhub  ";

  try {
    const config = loadBackendConfig();
    assert.equal(config.redisUrl, "redis://localhost:6379");
    assert.equal(config.instanceId, "my-instance");
    assert.equal(config.webPubSubHub, "myhub");
  } finally {
    Object.assign(process.env, saved);
  }
});

test("loadBackendConfig treats whitespace-only strings as empty", () => {
  const saved = { ...process.env };
  process.env.REDIS_URL = "   ";
  process.env.INSTANCE_ID = "   ";
  process.env.WEB_PUBSUB_CONNECTION_STRING = "   ";

  try {
    const config = loadBackendConfig();
    assert.equal(config.redisUrl, undefined);
    assert.ok(config.instanceId.length > 0); // falls back to hostname-pid
    assert.equal(config.webPubSubConnectionString, undefined);
  } finally {
    Object.assign(process.env, saved);
  }
});
