/**
 * Cursor Langfuse Hook 的工具函数
 */

/**
 * 从 stdin 读取并解析 JSON 输入
 * Cursor Hook 会通过 stdin 以 JSON 格式传递数据
 * @returns {Promise<object>} 从 stdin 解析得到的 JSON 对象
 */
export async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Failed to parse JSON from stdin: ${e.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * 根据提示词生成有描述性的 trace 名称
 * @param {string} prompt - 用户输入的提示词文本
 * @param {string} model - 当前使用的模型
 * @returns {string} 有描述性的 trace 名称
 */
export function generateTraceName(prompt, model) {
  if (!prompt) {
    return `Cursor ${model || 'Agent'}`;
  }
  
  // 提取提示词中前几个有意义的词语（最多 50 个字符）
  const cleaned = prompt
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const maxLength = 50;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // 尽量在单词边界处截断
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 30) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * 根据工作区根路径生成会话 ID
 * 将同一工作区中的所有对话归为一组
 * @param {string[]} workspaceRoots - 工作区根路径数组
 * @returns {string} 会话 ID
 */
export function generateSessionId(workspaceRoots) {
  if (!workspaceRoots || workspaceRoots.length === 0) {
    return 'cursor-default-session';
  }
  
  // 使用第一个工作区根路径作为会话标识
  // 仅提取文件夹名称，让会话名更简洁
  const root = workspaceRoots[0];
  const folderName = root.split('/').pop() || root;
  
  return `cursor-${folderName}`;
}

/**
 * 根据 Hook 活动动态生成标签
 * @param {string} hookName - 当前执行的 Hook 名称
 * @param {object} input - Hook 的输入数据
 * @param {Set<string>} existingTags - 需要追加标签的已有标签集合
 * @returns {string[]} 标签数组
 */
export function generateTags(hookName, input, existingTags = new Set()) {
  const tags = new Set(existingTags);
  
  // 始终添加 cursor 标签
  tags.add('cursor');
  
  // 根据 Hook 类型添加 agent 或 tab 标签
  if (hookName.includes('Tab')) {
    tags.add('tab');
  } else {
    tags.add('agent');
  }
  
  // 添加模型相关标签
  if (input.model) {
    // 将模型名称规范化为适合作为标签的格式
    const modelTag = input.model
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    tags.add(modelTag);
  }
  
  // 添加 Hook 类型专属标签
  switch (hookName) {
    case 'beforeShellExecution':
    case 'afterShellExecution':
      tags.add('shell');
      break;
    case 'beforeMCPExecution':
    case 'afterMCPExecution':
      tags.add('mcp');
      if (input.tool_name) {
        tags.add(`mcp-${input.tool_name.toLowerCase().substring(0, 20)}`);
      }
      break;
    case 'beforeReadFile':
    case 'afterFileEdit':
    case 'beforeTabFileRead':
    case 'afterTabFileEdit':
      tags.add('file-ops');
      break;
    case 'afterAgentThought':
      tags.add('thinking');
      break;
  }
  
  return Array.from(tags);
}

/**
 * 根据状态或上下文判断观测级别
 * @param {string} status - 状态值（例如 'completed'、'error'、'aborted'）
 * @param {boolean} isBlocked - 操作是否被阻止
 * @returns {string} 级别：'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR'
 */
export function determineLevel(status, isBlocked = false) {
  if (isBlocked) {
    return 'WARNING';
  }
  
  switch (status) {
    case 'error':
      return 'ERROR';
    case 'aborted':
      return 'WARNING';
    case 'completed':
    default:
      return 'DEFAULT';
  }
}

/**
 * 根据编辑数组计算编辑统计信息
 * @param {Array<{old_string: string, new_string: string}>} edits - 编辑数组
 * @returns {object} 编辑统计信息
 */
export function calculateEditStats(edits) {
  if (!edits || !Array.isArray(edits)) {
    return { editCount: 0, linesAdded: 0, linesRemoved: 0 };
  }
  
  let linesAdded = 0;
  let linesRemoved = 0;
  
  for (const edit of edits) {
    const oldLines = (edit.old_string || '').split('\n').length;
    const newLines = (edit.new_string || '').split('\n').length;
    
    if (newLines > oldLines) {
      linesAdded += newLines - oldLines;
    } else if (oldLines > newLines) {
      linesRemoved += oldLines - newLines;
    }
  }
  
  return {
    editCount: edits.length,
    linesAdded,
    linesRemoved,
    netChange: linesAdded - linesRemoved,
  };
}

/**
 * 从文件路径中提取扩展名
 * @param {string} filePath - 文件路径
 * @returns {string} 文件扩展名（不含点），如果无法识别则返回 'unknown'
 */
export function getFileExtension(filePath) {
  if (!filePath) return 'unknown';
  
  const parts = filePath.split('.');
  if (parts.length < 2) return 'unknown';
  
  return parts.pop().toLowerCase();
}

/**
 * 将毫秒时长格式化为便于阅读的字符串
 * @param {number} ms - 毫秒单位的时长
 * @returns {string} 格式化后的时长字符串
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '0ms';
  
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

