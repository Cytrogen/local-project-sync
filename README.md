# 本地代码知识库同步 MCP 工具

这是一个基于 **模型上下文协议**（Model Context Protocol, MCP）开发的服务端工具，旨在将你的本地项目代码目录无缝连接到支持 MCP 的 AI 应用（如 Claude 桌面版），从而将你的本地代码库变成一个可供 AI 实时查询和分析的动态知识库。

你不再需要手动上传文件或依赖云端仓库同步，AI 可以直接与你本地最新的代码进行交互。

## 主要功能

本项目通过实现多个 MCP 工具，为 AI 提供了与本地文件系统交互的超能力：

### 基础工具

1. `list_project_files`：递归地列出所有已配置目录中的文件，提供项目全貌
2. `read_file_content`：读取单个指定文件的完整内容，用于深度代码分析
3. `analyze_project_structure`：生成项目结构的概览和统计信息，帮助快速了解项目

### 智能搜索工具

1. `search_code_content`：在整个代码库中进行智能搜索，支持：

   - 普通文本搜索和正则表达式搜索 
   - 深层目录结构精确定位 
   - 可配置的上下文行数，避免返回过多内容 
   - 文件类型过滤和结果数量控制

### 高效读取工具

1. `read_multiple_files`：使用 `glob` 模式批量读取多个文件的内容，方便提供模块级上下文
2. `extract_function_definition`：精确提取指定函数/方法的完整定义，包括注释和装饰器
3. `read_file_section`：读取文件的指定行范围，获取精确的代码片段

## 快速开始

### 安装与配置

1. 克隆仓库

    ```bash
    git clone https://github.com/cytrogen/mcp-local-sync.git
    cd mcp-local-sync
    ```

2. 安装依赖

    ```bash
    npm install
   
    yarn install
    ```
   
3. 配置同步路径

   1. 打开 `src/index.ts` 文件
   2. 找到 `SYNC_PATHS` 这个常量数组
   3. 将其中的示例路径替换为你自己电脑上希望同步的项目的绝对路径。你可以配置一个或多个路径：

       ```ts src/index.ts
       const SYNC_PATHS = [
         "D:\\your\\project\\directory\\src",
         "D:\\another\\project\\directory\\src"
       ];
       ```
4. 构建项目

    运行构建命令，将 TypeScript 代码编译为 JavaScript：
    
    ```bash
    npm run build
    
    yarn run build
    ```
   
    成功后，会在项目根目录下生成一个 `build` 文件夹。

### 连接到 Claude 桌面版

1. 找到并编辑 Claude 配置文件：

   - Windows：`%APPDATA%\Claude\claude_desktop_config.json`
   - macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`

    _如果文件或目录不存在，请手动创建它。_

2. 添加 MCP 服务器配置

    将以下 JSON 内容添加到配置文件中（注意：必须将 `args` 中的路径替换为你自己项目 `build/index.js` 文件的绝对路径）：
    
    ```json
    {
      "mcpServers": {
        "localProjectSync": {
          "command": "node",
          "args": [
            "D:\\path\\to\\your\\mcp-local-sync\\build\\index.js"
          ]
        }
      }
    }
    ```
   
3. 重启 Claude

   完全退出并重新启动 Claude 桌面应用。成功后，你可以在聊天输入框下的 `Search and Tools` 菜单项内看到 `localProjectSync` 这个工具。

## 使用示例

### 基础项目探索

```javascript
// 1. 了解项目结构
list_project_files()

// 2. 分析项目架构
analyze_project_structure({
  scope: "backend",
  depth: 3
})
```

### 智能代码搜索

```javascript
// 普通文本搜索
search_code_content({
  query: "EmailTemplateService",
  fileTypes: [".ts"],
  maxResults: 10
})

// 正则表达式搜索多个方法
search_code_content({
  query: "markFieldProblems|requestClientRevision|submitRevision",
  fileTypes: [".ts", ".js"],
  maxResults: 10,
  useRegex: true
})

// 搜索并返回上下文
search_code_content({
  query: "async function",
  contextLines: 5,  // 前后各5行上下文
  maxResults: 8
})
```

### 精确代码提取

```javascript
// 提取完整函数定义（推荐用法）
extract_function_definition({
  filePath: "[backend/src]/modules/email/services/email-template.service.ts",
  functionName: "renderTemplate",
  includeComments: true,
  includeDecorators: true
})

// 读取指定行范围
read_file_section({
  filePath: "[backend/src]/main.ts",
  startLine: 1,
  endLine: 50,
  showLineNumbers: true
})
```

### 批量文件分析

```javascript
// 读取模块内的所有服务
read_multiple_files({
  patterns: ["modules/*/services/*.service.ts"],
  maxFiles: 10
})

// 读取配置相关文件
read_multiple_files({
  patterns: ["config/*.ts", "*.config.ts"],   
  maxFiles: 5
})
```

### 组合使用示例

```text
// 完整的代码探索流程
1. analyze_project_structure() // 了解架构
2. search_code_content({query: "UserService", useRegex: false}) // 找到位置
3. extract_function_definition({functionName: "createUser"}) // 提取具体方法
4. read_multiple_files({patterns: ["**/user*.ts"]}) // 查看相关文件
```

### 高级搜索技巧

```javascript
// 查找所有 service 类
search_code_content({
  query: "export class.*Service",
  useRegex: true,
  fileTypes: [".ts"]
})

// 查找特定装饰器的使用
search_code_content({
  query: "@Injectable|@Controller|@Service",
  useRegex: true,
  contextLines: 3
})
```

## 注意事项

- 安全: 本工具具有读取指定目录内所有文件的权限。请确保你配置的 `SYNC_PATHS` 指向的是安全的项目目录，切勿将其指向包含敏感信息（如私钥、密码文件等）的系统目录
- 性能: 对于包含数十万个文件的超大型项目，`list_project_files` 和 `search_code_content` 的首次执行可能会比较慢
- 路径格式: 在与 AI 交互时，请尽量使用工具返回的、带前缀的完整文件路径（例如 `[backend/src]/main.ts`），以确保 AI 能准确调用工具

## 更新日志

### v3.0.0

- 新增 `extract_function_definition` 工具 
- 新增 `read_file_section` 工具 
- `search_code_content` 支持正则表达式和上下文行 
- 修复深层目录搜索问题 
- 优化conversation length使用

### v2.0.0

- 新增 `search_code_content` 和 `read_multiple_files`
- 新增 `analyze_project_structure`
