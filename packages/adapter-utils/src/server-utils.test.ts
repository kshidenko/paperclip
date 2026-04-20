import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { injectHowCanIHelper, runChildProcess } from "./server-utils.js";

describe("runChildProcess", () => {
  it("waits for onSpawn before sending stdin to the child", async () => {
    const spawnDelayMs = 150;
    const startedAt = Date.now();
    let onSpawnCompletedAt = 0;

    const result = await runChildProcess(
      randomUUID(),
      process.execPath,
      [
        "-e",
        "let data='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>data+=chunk);process.stdin.on('end',()=>process.stdout.write(data));",
      ],
      {
        cwd: process.cwd(),
        env: {},
        stdin: "hello from stdin",
        timeoutSec: 5,
        graceSec: 1,
        onLog: async () => {},
        onSpawn: async () => {
          await new Promise((resolve) => setTimeout(resolve, spawnDelayMs));
          onSpawnCompletedAt = Date.now();
        },
      },
    );
    const finishedAt = Date.now();

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello from stdin");
    expect(onSpawnCompletedAt).toBeGreaterThanOrEqual(startedAt + spawnDelayMs);
    expect(finishedAt - startedAt).toBeGreaterThanOrEqual(spawnDelayMs);
  });
});

describe("injectHowCanIHelper", () => {
  it("adds a workspace-independent how-can-i helper that targets the knowledge repo", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-how-can-i-test-"));
    const knowledgeDir = path.join(root, "knowlege");
    const workspaceDir = path.join(root, "workspace");
    const binDir = path.join(root, "bin");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      path.join(knowledgeDir, "package.json"),
      JSON.stringify({
        name: "knowledge-base",
        private: true,
        scripts: { knowledge: "echo ok" },
      }),
      "utf8",
    );
    const fakePnpmPath = path.join(binDir, "pnpm");
    await fs.writeFile(
      fakePnpmPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }), "utf8");
}
`,
      "utf8",
    );
    await fs.chmod(fakePnpmPath, 0o755);

    try {
      const injected = await injectHowCanIHelper({
        env: {
          PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          PAPERCLIP_HOW_CAN_I_HELPER_DIR: binDir,
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        },
        moduleDir: path.join(root, "paperclip", "packages", "adapters", "codex-local", "src", "server"),
        workspaceCwd: workspaceDir,
      });

      expect(injected.available).toBe(true);
      expect(injected.commandName).toBe("how-can-i");
      expect(injected.repoDir).toBe(knowledgeDir);
      expect(injected.commandPath).toBeTruthy();
      expect(path.dirname(injected.commandPath ?? "")).toBe(binDir);
      expect(injected.env.PAPERCLIP_HOW_CAN_I_COMMAND).toBe(injected.commandPath);
      expect(injected.env.PAPERCLIP_HOW_CAN_I_COMMAND_BASENAME).toBe("how-can-i");
      expect(injected.env.PAPERCLIP_HOW_CAN_I_REPO_DIR).toBe(knowledgeDir);

      const result = await runChildProcess(randomUUID(), "how-can-i", ["where", "is", "policy"], {
        cwd: workspaceDir,
        env: injected.env,
        timeoutSec: 5,
        graceSec: 1,
        onLog: async () => {},
      });
      expect(result.exitCode).toBe(0);

      const captured = JSON.parse(await fs.readFile(capturePath, "utf8")) as {
        argv: string[];
        cwd: string;
      };
      expect(captured.cwd).toBe(workspaceDir);
      expect(captured.argv).toEqual([
        "--dir",
        knowledgeDir,
        "knowledge",
        "how-can-i",
        "where",
        "is",
        "policy",
      ]);

      const absoluteResult = await runChildProcess(
        randomUUID(),
        injected.env.PAPERCLIP_HOW_CAN_I_COMMAND ?? "",
        ["where", "is", "policy"],
        {
          cwd: workspaceDir,
          env: injected.env,
          timeoutSec: 5,
          graceSec: 1,
          onLog: async () => {},
        },
      );
      expect(absoluteResult.exitCode).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("discovers the knowledge repo from HOME/project roots when workspace ancestry does not contain it", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-how-can-i-home-"));
    const fakeHome = path.join(root, "home");
    const knowledgeDir = path.join(fakeHome, "projects", "zero-human", "knowlege");
    const workspaceDir = path.join(root, "isolated", "workspace");
    const binDir = path.join(root, "bin");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      path.join(knowledgeDir, "package.json"),
      JSON.stringify({
        name: "knowledge-base",
        private: true,
        scripts: { knowledge: "echo ok" },
      }),
      "utf8",
    );

    const fakePnpmPath = path.join(binDir, "pnpm");
    await fs.writeFile(
      fakePnpmPath,
      `#!/usr/bin/env node
const fs = require("node:fs");
const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }), "utf8");
}
`,
      "utf8",
    );
    await fs.chmod(fakePnpmPath, 0o755);

    vi.stubEnv("HOME", fakeHome);

    try {
      const injected = await injectHowCanIHelper({
        env: {
          PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          PAPERCLIP_HOW_CAN_I_HELPER_DIR: binDir,
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        },
        moduleDir: path.join(root, "external-runtime", "module"),
        workspaceCwd: workspaceDir,
      });

      expect(injected.available).toBe(true);
      expect(injected.repoDir).toBe(knowledgeDir);
      expect(injected.commandPath).toBeTruthy();

      const result = await runChildProcess(randomUUID(), "how-can-i", ["policy"], {
        cwd: workspaceDir,
        env: injected.env,
        timeoutSec: 5,
        graceSec: 1,
        onLog: async () => {},
      });
      expect(result.exitCode).toBe(0);

      const captured = JSON.parse(await fs.readFile(capturePath, "utf8")) as {
        argv: string[];
      };
      expect(captured.argv).toEqual([
        "--dir",
        knowledgeDir,
        "knowledge",
        "how-can-i",
        "policy",
      ]);
    } finally {
      vi.unstubAllEnvs();
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
