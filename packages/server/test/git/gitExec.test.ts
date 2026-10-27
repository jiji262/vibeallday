import { afterEach, describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";

type ExecFileCallback = (
  error: Error | null,
  stdout?: string,
  stderr?: string,
) => void;

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async () => {
  const actual =
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    );
  return {
    ...actual,
    execFile: execFileMock,
  };
});

describe("Git execution", () => {
  it.each([
    [
      null,
      "SIGTERM",
      "Git operation timed out after 60 seconds.\npartial progress",
    ],
    ["ERR_CHILD_PROCESS_STDIO_MAXBUFFER", "SIGTERM", "partial progress"],
    [128, null, "partial progress"],
  ])(
    "distinguishes timeout from failure %s / %s",
    async (code, signal, stderr) => {
      execFileMock.mockImplementation(
        (
          _command: string,
          _args: string[],
          _options: unknown,
          callback: ExecFileCallback,
        ) => {
          callback(
            Object.assign(new Error("Command failed"), {
              code,
              signal,
              killed: true,
            }),
            "",
            "partial progress",
          );
          return { stdin: new PassThrough() };
        },
      );
      const { runGit } = await import("../../src/git/gitExec.js");
      await expect(
        runGit("/project", ["push"], { timeout: 60_000 }),
      ).rejects.toMatchObject({ stderr });
    },
  );

  it("preserves captured output on command failures", async () => {
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: ExecFileCallback,
      ) => {
        callback(new Error("git failed"), "partial output", "fatal detail");
        return { stdin: new PassThrough() };
      },
    );
    const { runGit } = await import("../../src/git/gitExec.js");
    await expect(runGit("/project", ["status"])).rejects.toMatchObject({
      stdout: "partial output",
      stderr: "fatal detail",
    });
  });
  it("passes NUL-delimited path input directly to Git stdin", async () => {
    const stdin = new PassThrough();
    const chunks: Buffer[] = [];
    stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: ExecFileCallback,
      ) => {
        stdin.on("finish", () => callback(null, "ignored\0", ""));
        return { stdin };
      },
    );
    const { runGit } = await import("../../src/git/gitExec.js");
    const input = "space name\0雪.txt\0";
    const result = await runGit("/project", ["check-ignore", "-z", "--stdin"], {
      input,
    });
    expect(Buffer.concat(chunks).toString()).toBe(input);
    expect(result.stdout).toBe("ignored\0");
  });
  afterEach(() => {
    execFileMock.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("keeps Git messages untranslated without touching the server locale", async () => {
    // Callers classify failures by Git's English stderr ("not a git
    // repository", "could not open"). Only the message catalog may
    // change: LC_ALL=C would also make LC_CTYPE ASCII and break non-ASCII
    // case-insensitive search and UTF-8 hooks.
    vi.stubEnv("LC_ALL", "zh_CN.UTF-8");
    vi.stubEnv("LANG", "zh_CN.UTF-8");
    vi.stubEnv("LANGUAGE", "zh_CN");
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: ExecFileCallback,
      ) => callback(null, "", ""),
    );
    const { buildGitEnv, runGit, runGitBytes } = await import(
      "../../src/git/gitExec.js"
    );

    await runGit("/project", ["status"], {
      env: { LANGUAGE: "de", LC_ALL: "de_DE.UTF-8" },
    });
    await runGitBytes("/project", ["fetch"], { disableTerminalPrompt: true });

    expect(execFileMock.mock.calls[0]?.[2]).toMatchObject({
      env: { LANGUAGE: "C", LC_ALL: "de_DE.UTF-8", LANG: "zh_CN.UTF-8" },
    });
    expect(execFileMock.mock.calls[1]?.[2]).toMatchObject({
      env: {
        LANGUAGE: "C",
        LC_ALL: "zh_CN.UTF-8",
        GIT_TERMINAL_PROMPT: "0",
      },
    });
    expect(buildGitEnv()).toMatchObject({
      LANGUAGE: "C",
      LC_ALL: "zh_CN.UTF-8",
    });
  });

  it("disables optional locks for text and binary commands", async () => {
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: ExecFileCallback,
      ) => callback(null, "", ""),
    );
    const { buildGitProcessArgs, runGit, runGitBytes } = await import(
      "../../src/git/gitExec.js"
    );

    expect(buildGitProcessArgs(["clone", "source", "destination"])).toEqual([
      "--no-optional-locks",
      "clone",
      "source",
      "destination",
    ]);

    await runGit("/project", ["status", "--porcelain=v2"]);
    await runGitBytes("/project", ["show", "HEAD:file"]);

    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      "git",
      ["--no-optional-locks", "-C", "/project", "status", "--porcelain=v2"],
      expect.any(Object),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      "git",
      ["--no-optional-locks", "-C", "/project", "show", "HEAD:file"],
      expect.any(Object),
      expect.any(Function),
    );
  });
});
