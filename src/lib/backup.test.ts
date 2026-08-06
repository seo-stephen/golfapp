import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, isBackupFile } from "./backup";

const valid = {
  app: "bogeyboys",
  version: BACKUP_VERSION,
  exportedAt: "2026-08-05T00:00:00.000Z",
  courses: [],
  rounds: [],
  swingSessions: [],
};

describe("isBackupFile", () => {
  it("accepts a well-formed backup", () => {
    expect(isBackupFile(valid)).toBe(true);
  });

  it("rejects arbitrary JSON the user might pick by mistake", () => {
    expect(isBackupFile({ hello: "world" })).toBe(false);
    expect(isBackupFile([])).toBe(false);
    expect(isBackupFile("a string")).toBe(false);
    expect(isBackupFile(42)).toBe(false);
    expect(isBackupFile(null)).toBe(false);
    expect(isBackupFile(undefined)).toBe(false);
  });

  it("rejects a backup from a different app", () => {
    expect(isBackupFile({ ...valid, app: "some-other-golf-app" })).toBe(false);
  });

  it("rejects a file missing the record arrays", () => {
    expect(isBackupFile({ ...valid, courses: undefined })).toBe(false);
    expect(isBackupFile({ ...valid, rounds: "not an array" })).toBe(false);
  });

  it("rejects a non-numeric version", () => {
    expect(isBackupFile({ ...valid, version: "1" })).toBe(false);
  });

  it("accepts a backup whose version is older than the current one", () => {
    // Forward compatibility: restoreBackup only rejects NEWER versions.
    expect(isBackupFile({ ...valid, version: 0 })).toBe(true);
  });
});
