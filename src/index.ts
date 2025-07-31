import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { glob } from "glob";

// --- 配置区 ---
const SYNC_PATHS = [
  "D:\\Programs\\Novus\\frontend\\src",
  "D:\\Programs\\Novus\\backend\\src"
];

const IGNORED_PATTERNS = new Set(['node_modules', '.git', '.idea', 'dist', 'build', '.DS_Store']);

const pathRegistry = new Map<string, string>();
SYNC_PATHS.forEach(p => {
  if (!p) return; // 跳过空路径
  const parentDir = path.basename(path.dirname(p));
  const selfDir = path.basename(p);
  const prefix = `[${parentDir}/${selfDir}]`;
  pathRegistry.set(prefix, p);
});

console.error("Configuration loaded. Syncing paths:", SYNC_PATHS);

async function getFilesRecursive(directory: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const dirents = await fs.readdir(directory, { withFileTypes: true });
    for (const dirent of dirents) {
      if (IGNORED_PATTERNS.has(dirent.name)) continue;
      const fullPath = path.join(directory, dirent.name);
      const relativePath = path.relative(directory, fullPath);
      if (dirent.isDirectory()) {
        const subFiles = await getFilesRecursive(fullPath);
        files.push(...subFiles.map(sf => path.join(relativePath, sf).replace(/\\/g, '/')));
      } else {
        files.push(relativePath.replace(/\\/g, '/'));
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
  }
  return files;
}

async function analyzeDirectory(dirPath: string, maxDepth: number, currentDepth = 0): Promise<any> {
  if (currentDepth >= maxDepth) return null;

  const result: any = { name: path.basename(dirPath), type: 'directory', children: [] };

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (IGNORED_PATTERNS.has(item.name)) continue;

      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const subResult = await analyzeDirectory(fullPath, maxDepth, currentDepth + 1);
        if (subResult) result.children.push(subResult);
      } else {
        result.children.push({
          name: item.name,
          type: 'file',
          extension: path.extname(item.name)
        });
      }
    }
  } catch (error) {
    console.error(`分析目录 ${dirPath} 时出错:`, error);
  }

  return result;
}

function formatStructure(structure: any, indent: number): string {
  if (!structure) return '';

  const spaces = '  '.repeat(indent);
  let result = `${spaces}${structure.type === 'directory' ? '📁' : '📄'} ${structure.name}\n`;

  if (structure.children) {
    for (const child of structure.children) {
      result += formatStructure(child, indent + 1);
    }
  }

  return result;
}

async function getDirectoryStats(dirPath: string): Promise<any> {
  const stats = {
    tsFiles: 0,
    jsFiles: 0,
    components: 0,
    services: 0,
    directories: 0
  };

  async function countFiles(dir: string) {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        if (IGNORED_PATTERNS.has(item.name)) continue;

        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          stats.directories++;
          await countFiles(fullPath);
        } else {
          const ext = path.extname(item.name);
          const name = item.name.toLowerCase();

          if (ext === '.ts' || ext === '.tsx') stats.tsFiles++;
          if (ext === '.js' || ext === '.jsx') stats.jsFiles++;
          if (name.includes('component') || ext === '.tsx' || ext === '.jsx') stats.components++;
          if (name.includes('service')) stats.services++;
        }
      }
    } catch (error) {
      // 忽略错误，继续统计
    }
  }

  await countFiles(dirPath);
  return stats;
}

/**
 * 提取函数定义的辅助函数
 */
function extractFunctionDefinition(
  lines: string[],
  functionName: string,
  includeComments: boolean,
  includeDecorators: boolean
): { found: boolean; content: string; startLine: number; endLine: number } {
  const result = { found: false, content: '', startLine: 0, endLine: 0 };

  // 匹配函数定义的正则表达式
  const functionPatterns = [
    // async methodName(
    new RegExp(`^\\s*async\\s+${functionName}\\s*\\(`),
    // methodName(
    new RegExp(`^\\s*${functionName}\\s*\\(`),
    // private/public/protected async methodName(
    new RegExp(`^\\s*(private|public|protected)\\s+(async\\s+)?${functionName}\\s*\\(`),
    // function functionName(
    new RegExp(`^\\s*(export\\s+)?(async\\s+)?function\\s+${functionName}\\s*\\(`),
    // const functionName =
    new RegExp(`^\\s*(export\\s+)?const\\s+${functionName}\\s*=`),
    // functionName:
    new RegExp(`^\\s*${functionName}\\s*:`),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否匹配函数定义
    const isMatch = functionPatterns.some(pattern => pattern.test(line));

    if (isMatch) {
      let startIndex = i;
      let endIndex = i;

      // 向上查找注释和装饰器
      if (includeComments || includeDecorators) {
        let searchIndex = i - 1;
        while (searchIndex >= 0) {
          const prevLine = lines[searchIndex].trim();

          // 跳过空行
          if (prevLine === '') {
            searchIndex--;
            continue;
          }

          // 包含注释
          if (includeComments && (prevLine.startsWith('//') || prevLine.startsWith('/*') || prevLine.startsWith('*') || prevLine.endsWith('*/'))) {
            startIndex = searchIndex;
            searchIndex--;
            continue;
          }

          // 包含装饰器
          if (includeDecorators && prevLine.startsWith('@')) {
            startIndex = searchIndex;
            searchIndex--;
            continue;
          }

          // 如果不是注释或装饰器，停止向上搜索
          break;
        }
      }

      // 向下查找函数结束位置
      let braceCount = 0;
      let inFunction = false;

      for (let j = i; j < lines.length; j++) {
        const currentLine = lines[j];

        // 计算大括号
        for (const char of currentLine) {
          if (char === '{') {
            braceCount++;
            inFunction = true;
          } else if (char === '}') {
            braceCount--;
          }
        }

        endIndex = j;

        // 如果找到了函数开始的大括号，并且括号已经平衡，则结束
        if (inFunction && braceCount === 0) {
          break;
        }

        // 对于箭头函数或单行函数，特殊处理
        if (!inFunction && (currentLine.includes('=>') || currentLine.includes(';'))) {
          break;
        }
      }

      // 提取内容
      const extractedLines = lines.slice(startIndex, endIndex + 1);
      result.found = true;
      result.content = extractedLines.join('\n');
      result.startLine = startIndex + 1;
      result.endLine = endIndex + 1;

      return result;
    }
  }

  return result;
}

const server = new McpServer({
  name: "local-project-sync",
  version: "3.0.0",
});

console.error("MCP Server 'local-project-sync' is starting...");

server.tool(
  "list_project_files",
  "递归列出所有已配置同步目录中的文件",
  {},
  async () => {
    let allFilesText = "项目文件列表:\n---\n";
    for (const [prefix, absolutePath] of pathRegistry.entries()) {
      const files = await getFilesRecursive(absolutePath);
      if (files.length > 0) {
        allFilesText += files.map(file => `${prefix}/${file}`).join('\n') + '\n';
      }
    }
    return { content: [{ type: "text", text: allFilesText }] };
  }
);

server.tool(
  "read_file_content",
  "读取项目内指定文件的内容，文件路径必须包含前缀，例如 '[backend/src]/main.ts'",
  {
    filePath: z.string().describe("带前缀的完整文件路径, e.g., '[backend/src]/main.ts'"),
  },
  async ({ filePath }) => {
    const match = filePath.match(/^(\[.*?\])\/(.*)$/s);
    if (!match) return { content: [{ type: "text", text: "错误：文件路径格式不正确，必须包含如 '[backend/src]/' 的前缀。" }] };

    const prefix = match[1];
    const relativePath = match[2];
    const rootPath = pathRegistry.get(prefix);

    if (!rootPath) return { content: [{ type: "text", text: `错误：未知的路径前缀 '${prefix}'。` }] };

    const resolvedPath = path.resolve(rootPath, relativePath);
    if (!resolvedPath.startsWith(path.resolve(rootPath))) return { content: [{ type: "text", text: "错误：禁止访问项目目录之外的文件。" }] };

    try {
      const fileContent = await fs.readFile(resolvedPath, "utf-8");
      return { content: [{ type: "text", text: `文件 '${filePath}' 的内容:\n---\n${fileContent}` }] };
    } catch (error: any) {
      let errorMessage = `读取文件 '${filePath}' 时发生错误。`;
      if (error.code === 'ENOENT') errorMessage = `错误：文件 '${filePath}' 未找到。`;
      console.error(errorMessage, error);
      return { content: [{ type: "text", text: errorMessage }] };
    }
  }
);

server.tool(
  "search_code_content",
  "在项目代码中搜索指定内容，支持正则表达式",
  {
    query: z.string().describe("搜索关键词或正则表达式"),
    fileTypes: z.array(z.string()).optional().describe("文件类型过滤，如 ['.ts', '.tsx', '.js']"),
    maxResults: z.number().optional().default(50).describe("最大结果数量"),
    caseSensitive: z.boolean().optional().default(false).describe("是否区分大小写"),
    useRegex: z.boolean().optional().default(false).describe("是否启用正则表达式模式"),
    contextLines: z.number().optional().default(0).describe("返回匹配行前后的上下文行数"),
  },
  async ({ query, fileTypes = ['.ts', '.tsx', '.js', '.jsx'], maxResults = 50, caseSensitive = false, useRegex = false, contextLines = 0 }) => {
    let results: Array<{file: string, lineNumber: number, content: string}> = [];
    
    for (const [prefix, absolutePath] of pathRegistry.entries()) {
      try {
        const files = await getFilesRecursive(absolutePath);
        const filteredFiles = files.filter(file => 
          fileTypes.some((ext: string) => file.endsWith(ext))
        );

        for (const file of filteredFiles) {
          if (results.length >= maxResults) break;
          
          try {
            const fullPath = path.join(absolutePath, file);
            const stats = await fs.stat(fullPath);
            if (!stats.isFile()) continue;
            
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');
            
            const flags = caseSensitive ? 'g' : 'gi';
            
            // 根据useRegex参数决定是否转义
            const processedQuery = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(processedQuery, flags);
            
            lines.forEach((line, index) => {
              if (results.length >= maxResults) return;
              if (regex.test(line)) {
                let resultContent: string;

                if (contextLines > 0) {
                  // 计算上下文范围
                  const startLine = Math.max(0, index - contextLines);
                  const endLine = Math.min(lines.length - 1, index + contextLines);

                  // 提取上下文，并添加行号
                  const contextContent = lines.slice(startLine, endLine + 1)
                    .map((l, i) => {
                      const lineNum = startLine + i + 1;
                      const marker = lineNum === (index + 1) ? '>>> ' : '    '; // 标记匹配行
                      return `${marker}${lineNum}: ${l}`;
                    })
                    .join('\n');

                  resultContent = contextContent;
                } else {
                  // 原来的逻辑：只返回匹配行
                  resultContent = line.trim();
                }

                results.push({
                  file: `${prefix}/${file}`,
                  lineNumber: index + 1,
                  content: line.trim()
                });
              }
            });
          } catch (error: any) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`搜索文件 ${file} 时出错:`, error.message);
            }
            continue;
          }
        }
      } catch (error: any) {
        console.error(`搜索路径 ${absolutePath} 时出错:`, error.message);
      }
    }

    const resultText = results.length > 0 
      ? `找到 ${results.length} 个匹配结果:\n---\n` + 
        results.map(r => `${r.file}:${r.lineNumber}\n${r.content}`).join('\n\n')
      : `未找到包含 "${query}" 的代码`;
    
    return { content: [{ type: "text", text: resultText }] };
  }
);

server.tool(
  "read_multiple_files",
  "批量读取多个文件内容，支持glob模式",
  {
    patterns: z.array(z.string()).describe("文件模式数组，如 ['modules/*/services/*.ts', 'config/*.ts']"),
    maxFiles: z.number().optional().default(20).describe("最大文件数量限制"),
  },
  async ({ patterns, maxFiles = 20 }) => {
    let allContent = "批量文件内容:\n" + "=".repeat(50) + "\n";
    let fileCount = 0;

    for (const [prefix, absolutePath] of pathRegistry.entries()) {
      for (const pattern of patterns) {
        try {
          const fullPattern = path.join(absolutePath, pattern);
          const matchedFiles = await glob(fullPattern, {
            ignore: ['**/node_modules/**', '**/.git/**']
          });

          for (const file of matchedFiles) {
            if (fileCount >= maxFiles) break;

            try {
              const relativePath = path.relative(absolutePath, file);
              const content = await fs.readFile(file, 'utf-8');
              allContent += `\n📄 ${prefix}/${relativePath}\n`;
              allContent += "-".repeat(30) + "\n";
              allContent += content + "\n";
              fileCount++;
            } catch (error) {
              allContent += `\n无法读取: ${file}\n`;
            }
          }
        } catch (error) {
          console.error(`处理模式 ${pattern} 时出错:`, error);
        }

        if (fileCount >= maxFiles) break;
      }
      if (fileCount >= maxFiles) break;
    }

    return { content: [{ type: "text", text: allContent }] };
  }
);

server.tool(
  "analyze_project_structure",
  "分析项目结构，生成模块和功能概览",
  {
    scope: z.enum(['frontend', 'backend', 'all']).optional().default('all').describe("分析范围"),
    depth: z.number().optional().default(3).describe("目录深度"),
  },
  async ({ scope, depth = 3 }) => {
    let analysis = "项目结构分析:\n" + "=".repeat(50) + "\n";

    for (const [prefix, absolutePath] of pathRegistry.entries()) {
      // 根据scope过滤
      if (scope !== 'all') {
        if (scope === 'frontend' && !prefix.includes('frontend')) continue;
        if (scope === 'backend' && !prefix.includes('backend')) continue;
      }

      analysis += `\n📁 ${prefix}\n`;
      analysis += "-".repeat(30) + "\n";

      try {
        const structure = await analyzeDirectory(absolutePath, depth);
        analysis += formatStructure(structure, 0);

        // 添加统计信息
        const stats = await getDirectoryStats(absolutePath);
        analysis += `\n📊 统计信息:\n`;
        analysis += `  - TypeScript文件: ${stats.tsFiles}\n`;
        analysis += `  - JavaScript文件: ${stats.jsFiles}\n`;
        analysis += `  - 组件文件: ${stats.components}\n`;
        analysis += `  - 服务文件: ${stats.services}\n`;
        analysis += `  - 总目录数: ${stats.directories}\n`;

      } catch (error) {
        analysis += `分析失败: ${error}\n`;
      }
    }

    return { content: [{ type: "text", text: analysis }] };
  }
);

server.tool(
  "extract_function_definition",
  "提取指定函数/方法的完整定义，包括注释和装饰器",
  {
    filePath: z.string().describe("带前缀的完整文件路径, e.g., '[backend/src]/main.ts'"),
    functionName: z.string().describe("函数/方法名"),
    includeComments: z.boolean().optional().default(true).describe("是否包含上方的注释"),
    includeDecorators: z.boolean().optional().default(true).describe("是否包含装饰器"),
  },
  async ({ filePath, functionName, includeComments = true, includeDecorators = true }) => {
    const match = filePath.match(/^(\[.*?\])\/(.*)$/s);
    if (!match) return { content: [{ type: "text", text: "错误：文件路径格式不正确，必须包含如 '[backend/src]/' 的前缀。" }] };

    const prefix = match[1];
    const relativePath = match[2];
    const rootPath = pathRegistry.get(prefix);

    if (!rootPath) return { content: [{ type: "text", text: `错误：未知的路径前缀 '${prefix}'。` }] };

    const resolvedPath = path.resolve(rootPath, relativePath);
    if (!resolvedPath.startsWith(path.resolve(rootPath))) return { content: [{ type: "text", text: "错误：禁止访问项目目录之外的文件。" }] };

    try {
      const fileContent = await fs.readFile(resolvedPath, "utf-8");
      const lines = fileContent.split('\n');

      // 查找函数定义
      const functionResult = extractFunctionDefinition(lines, functionName, includeComments, includeDecorators);

      if (functionResult.found) {
        const resultText = `函数 '${functionName}' 在 '${filePath}' 中的定义:\n` +
          `行号 ${functionResult.startLine}-${functionResult.endLine}\n` +
          "---\n" + functionResult.content;
        return { content: [{ type: "text", text: resultText }] };
      } else {
        return { content: [{ type: "text", text: `未在 '${filePath}' 中找到函数 '${functionName}'` }] };
      }
    } catch (error: any) {
      let errorMessage = `读取文件 '${filePath}' 时发生错误。`;
      if (error.code === 'ENOENT') errorMessage = `错误：文件 '${filePath}' 未找到。`;
      console.error(errorMessage, error);
      return { content: [{ type: "text", text: errorMessage }] };
    }
  }
);

server.tool(
  "read_file_section",
  "读取文件的指定行范围",
  {
    filePath: z.string().describe("带前缀的完整文件路径, e.g., '[backend/src]/main.ts'"),
    startLine: z.number().describe("起始行号（从1开始）"),
    endLine: z.number().describe("结束行号（包含）"),
    showLineNumbers: z.boolean().optional().default(true).describe("是否显示行号"),
  },
  async ({ filePath, startLine, endLine, showLineNumbers = true }) => {
    const match = filePath.match(/^(\[.*?\])\/(.*)$/s);
    if (!match) return { content: [{ type: "text", text: "错误：文件路径格式不正确，必须包含如 '[backend/src]/' 的前缀。" }] };

    const prefix = match[1];
    const relativePath = match[2];
    const rootPath = pathRegistry.get(prefix);

    if (!rootPath) return { content: [{ type: "text", text: `错误：未知的路径前缀 '${prefix}'。` }] };

    const resolvedPath = path.resolve(rootPath, relativePath);
    if (!resolvedPath.startsWith(path.resolve(rootPath))) return { content: [{ type: "text", text: "错误：禁止访问项目目录之外的文件。" }] };

    try {
      const fileContent = await fs.readFile(resolvedPath, "utf-8");
      const lines = fileContent.split('\n');

      // 验证行号范围
      if (startLine < 1) startLine = 1;
      if (endLine > lines.length) endLine = lines.length;
      if (startLine > endLine) {
        return { content: [{ type: "text", text: `错误：起始行号 ${startLine} 大于结束行号 ${endLine}` }] };
      }

      // 提取指定行范围（转换为0-based索引）
      const selectedLines = lines.slice(startLine - 1, endLine);

      let resultContent: string;
      if (showLineNumbers) {
        resultContent = selectedLines
          .map((line, index) => `${startLine + index}: ${line}`)
          .join('\n');
      } else {
        resultContent = selectedLines.join('\n');
      }

      const resultText = `文件 '${filePath}' 第 ${startLine}-${endLine} 行内容:\n---\n${resultContent}`;
      return { content: [{ type: "text", text: resultText }] };

    } catch (error: any) {
      let errorMessage = `读取文件 '${filePath}' 时发生错误。`;
      if (error.code === 'ENOENT') errorMessage = `错误：文件 '${filePath}' 未找到。`;
      console.error(errorMessage, error);
      return { content: [{ type: "text", text: errorMessage }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Local Project Sync MCP Server is running and connected via stdio.");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
