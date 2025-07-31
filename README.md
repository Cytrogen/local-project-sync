# 本地代码知识库同步 MCP 工具

这是一个基于 **模型上下文协议**（Model Context Protocol, MCP）开发的服务端工具，旨在将你的本地项目代码目录无缝连接到支持 MCP 的 AI 应用（如 Claude 桌面版），从而将你的本地代码库变成一个可供 AI 实时查询和分析的动态知识库。

你不再需要手动上传文件或依赖云端仓库同步，AI 可以直接与你本地最新的代码进行交互。

## 主要功能

本项目通过实现多个 MCP 工具，为 AI 提供了与本地文件系统交互的超能力：

1. `list_project_files`：递归地列出所有已配置目录中的文件，提供项目全貌
2. `read_file_content`：读取单个指定文件的完整内容，用于深度代码分析
3. `search_code_content`：在整个代码库中进行智能搜索，支持普通文本和正则表达式两种模式，能够在深层目录结构中精确定位代码片段
4. `read_multiple_files`：使用 `glob` 模式批量读取多个文件的内容，方便提供模块级上下文
5. `analyze_project_structure`：生成项目结构的概览和统计信息，帮助快速了解项目

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

## 工具用法详解

下面是每个工具的详细用途、差异和使用场景：

1. `list_project_files`

   - 用途：获取一个完整的、递归的文件列表
   - 差异：与其它工具不同，它不关心文件内容，只提供文件结构的全景图
   - 使用场景：
     - 当你刚接触一个项目，想知道它包含了哪些文件时
     - 当你不确定某个文件的确切路径或名称时

2. `read_file_content`

   - 用途：读取单个文件的完整内容
   - 差异：目标明确，只针对一个文件。AI 在进行深度分析前，通常会先调用它来获取上下文
   - 使用场景：
     - 让 AI 分析、重构或解释某个特定文件的代码
     - 修复某个文件中的 bug

3. `search_code_content`

   - 用途: 在所有已配置的文件中搜索一个关键词或正则表达式
   - 差异: 适合大海捞针（当你只记得一个函数名或一个特定的字符串，但不知道它在哪个文件里时）
   - 使用场景：
     - 查找某个函数或变量在整个项目中的所有引用
     - 定位所有使用了某个特定 API 或配置项的地方

4. `read_multiple_files`

   - 用途: 使用 `glob` 模式一次性读取多个文件的内容
   - 差异: `read_file_content` 的批量版本。它能高效地为 AI 提供一个完整模块或一组相关文件的上下文
   - 使用场景：
     - 让 AI 理解一个完整的业务模块（例如，某个用户认证模块下的所有 `services` 和 `controllers`）
     - 比较多个相似配置文件之间的差异

5. `analyze_project_structure`

   - 用途: 提供一个高层次的项目结构概览和代码统计
   - 差异: 不返回代码内容，而是返回元数据（metadata）。它像一个项目“体检报告”
   - 使用场景：
     - 快速了解一个陌生项目的技术栈和规模（例如，TS 文件和 JS 文件的比例）
     - 向团队成员介绍项目的大致模块划分

## 注意事项

- 安全: 本工具具有读取指定目录内所有文件的权限。请确保你配置的 `SYNC_PATHS` 指向的是安全的项目目录，切勿将其指向包含敏感信息（如私钥、密码文件等）的系统目录
- 性能: 对于包含数十万个文件的超大型项目，`list_project_files` 和 `search_code_content` 的首次执行可能会比较慢
- 路径格式: 在与 AI 交互时，请尽量使用工具返回的、带前缀的完整文件路径（例如 `[backend/src]/main.ts`），以确保 AI 能准确调用工具
