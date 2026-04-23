/**
 * Langfuse 客户端模块
 *
 * 负责 Langfuse SDK 的初始化与 trace 管理，
 * 同时支持会话、评分以及动态元数据。
 */

import { Langfuse } from "langfuse";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { generateTraceName, generateSessionId, generateTags } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 从项目根目录加载 .env（位于 lib/ 上三级）
const projectRoot = resolve(__dirname, "..", "..", "..");
config({ path: resolve(projectRoot, ".env") });

// 兜底方案：如果未找到密钥，则尝试使用当前工作目录
if (!process.env.LANGFUSE_SECRET_KEY) {
  config({ path: resolve(process.cwd(), ".env") });
}

export const HOOK_HANDLER_VERSION = "1.2.0";

let langfuseInstance = null;

/**
 * 获取 Langfuse 客户端实例
 * @returns {Langfuse} Langfuse 客户端实例
 */
export function getLangfuseClient() {
  if (!langfuseInstance) {
    langfuseInstance = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
      release: HOOK_HANDLER_VERSION,
    });
  }
  return langfuseInstance;
}

/**
 * 获取或创建 Langfuse trace
 * @param {object} input - 输入数据
 * @param {string} customName - 自定义 trace 名称
 * @returns {LangfuseTrace} Langfuse trace 实例
 */
export function getOrCreateTrace(input, customName = null) {
  const langfuse = getLangfuseClient();
  const sessionId = generateSessionId(input.workspace_roots);
  const traceName =
    customName ||
    generateTraceName(input.prompt, input.model) ||
    `${input.hook_event_name || "未知"} - ${input.model || "Agent"}`;
  const tags = generateTags(input.hook_event_name, input);

  return langfuse.trace({
    id: input.conversation_id,
    name: traceName,
    sessionId: sessionId,
    userId: input.user_email || undefined,
    release: HOOK_HANDLER_VERSION,
    version: input.cursor_version,
    metadata: {
      cursor_version: input.cursor_version,
      model: input.model,
      workspace_roots: input.workspace_roots,
      generation_id: input.generation_id,
    },
    tags: tags,
  });
}

/**
 * 添加标签到 Langfuse trace
 * @param {LangfuseTrace} trace - Langfuse trace 实例
 * @param {string[]} newTags - 新的标签数组
 */
export function addTagsToTrace(trace, newTags) {
  if (trace && newTags && newTags.length > 0) {
    trace.update({ tags: newTags });
  }
}

export function addScore(
  trace,
  name,
  value,
  comment = null,
  dataType = "NUMERIC"
) {
  if (trace) {
    trace.score({ name, value, comment, dataType });
  }
}

export function addCompletionScores(trace, input) {
  let statusScore = 0;
  let statusComment = "";

  switch (input.status) {
    case "completed":
      statusScore = 1;
      statusComment = "Agent completed successfully";
      break;
    case "aborted":
      statusScore = 0.5;
      statusComment = "Agent was aborted by user";
      break;
    case "error":
      statusScore = 0;
      statusComment = "Agent encountered an error";
      break;
    default:
      statusScore = 0.5;
      statusComment = `Unknown status: ${input.status}`;
  }

  addScore(trace, "completion_status", statusScore, statusComment);

  // 效率分数：循环次数越少分数越高（10 次及以上为 0）
  if (typeof input.loop_count === "number") {
    const efficiencyScore = Math.max(0, 1 - input.loop_count / 10);
    addScore(
      trace,
      "efficiency",
      efficiencyScore,
      `Completed in ${input.loop_count} loops`
    );
  }
}

export async function flushLangfuse() {
  const langfuse = getLangfuseClient();
  await langfuse.flushAsync();
}

export async function shutdownLangfuse() {
  const langfuse = getLangfuseClient();
  await langfuse.shutdownAsync();
}
