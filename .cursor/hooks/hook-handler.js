#!/usr/bin/env node

/**
 * Cursor Hooks 与 Langfuse 集成
 * 
 * Cursor hooks 的主入口，用于将 trace 发送到 Langfuse。
 * 
 * 功能：
 * - 支持全部 12 个 Cursor hook（Agent + Tab）
 * - 按 conversation_id 对 trace 分组
 * - 按 workspace 对 session 分组
 * - 基于活动的动态标签
 * - 完成度评分与效率指标
 * - 丰富的元数据与编辑统计
 * 
 * @version 1.1.0
 * @see https://cursor.com/docs/agent/hooks
 * @see https://langfuse.com/docs
 */

import { readStdin } from './lib/utils.js';
import { 
  getOrCreateTrace, 
  flushLangfuse,
  HOOK_HANDLER_VERSION,
} from './lib/langfuse-client.js';
import { routeHookHandler } from './lib/handlers.js';

/**
 * 主处理函数
 * 从 stdin 读取 hook 数据，创建 Langfuse trace，并路由到对应的处理器
 */
async function main() {
  try {
    // 从 stdin 读取 JSON 输入
    const input = await readStdin();

    // 获取或创建该会话对应的 trace
    const trace = getOrCreateTrace(input);
    
    // 根据 hook 类型路由到对应处理器
    const hookName = input.hook_event_name;
    const response = routeHookHandler(hookName, trace, input);
    
    // 若处理器返回了响应，则输出给 Cursor
    if (response !== null && response !== undefined) {
      console.log(JSON.stringify(response));
    }
    
    // 退出前将所有待发送事件 flush 到 Langfuse
    await flushLangfuse();
    
  } catch (error) {
    // 记录错误但不让流程中断 —— 我们不希望阻塞 Cursor
    console.error(`[Langfuse Hook v${HOOK_HANDLER_VERSION}] Error: ${error.message}`);
    
    // 仍然输出一个“放行”的响应，确保 Cursor 可以继续执行
    // 这可以避免在发生异常时 hook 阻塞后续操作
    console.log(JSON.stringify({ 
      continue: true, 
      permission: 'allow' 
    }));
    
    process.exit(1);
  }
}

// 运行主函数
main();
