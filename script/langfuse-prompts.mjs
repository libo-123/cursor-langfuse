import { execFile } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";


// 运行说明
// 1. 在项目根目录创建一个 .env 文件，并填入你的 Langfuse 凭据：
// 2. 运行 `node script/langfuse-prompts.mjs` 命令，列出所有提示词（prompt names）
// 3. 运行 `node script/langfuse-prompts.mjs "name"` 命令，获取某个 Prompt（默认 production label）

/**
 * 解析 .env 文件
 * @param {*} content 
 * @returns 
 */
function parseDotenv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const hash = value.indexOf(" #");
    if (hash !== -1) value = value.slice(0, hash).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/**
 * 从项目根目录加载 .env 文件
 * @returns {Object} 环境变量对象
 */
function loadEnvFromRepoRoot() {
  const repoRoot = process.cwd();
  const envPath = path.join(repoRoot, ".env");
  if (!existsSync(envPath)) return {};
  try {
    return parseDotenv(readFileSync(envPath, "utf8"));
  } catch {
    return {};
  }
}

/**
 * 检查是否存在必需的环境变量
 * @param {Object} env 环境变量对象
 * @returns {boolean} 是否存在必需的环境变量
 */
function requiredKeysPresent(env) {
  return Boolean(env.LANGFUSE_HOST && env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

/**
 * 运行 Langfuse CLI
 * @param {string[]} args 命令行参数
 * @param {Object} env 环境变量对象
 * @returns {Promise<string>} 命令行输出
 */
function runLangfuseCli(args, env) {
  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      ["-y", "langfuse-cli", "api", "prompts", ...args, "--json"],
      { env, maxBuffer: 50 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error((stderr && stderr.trim()) || err.message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function printUsage() {
  console.log(`用法:
  node scirpt/langfuse-prompts.mjs               # 列出所有提示词（prompt names）
  node scirpt/langfuse-prompts.mjs "name"        # 获取某个 Prompt（默认 production label）
  `);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  const dotenvEnv = loadEnvFromRepoRoot();
  const env = { ...dotenvEnv, ...process.env };

  if (!requiredKeysPresent(env)) {
    console.error(
      "缺少 Langfuse 环境变量。请在环境或 .env 中设置 LANGFUSE_HOST、LANGFUSE_PUBLIC_KEY、LANGFUSE_SECRET_KEY。"
    );
    process.exit(1);
  }

  const name = argv[0];
  if (!name) {
    const out = await runLangfuseCli(["list"], env);
    const parsed = JSON.parse(out);
    const items = parsed?.body?.data ?? [];
    for (const item of items) {
      console.log(item?.name);
    }
    return;
  }

  const out = await runLangfuseCli(["get", name], env);
  console.log(out.trim());
}

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exit(1);
});

