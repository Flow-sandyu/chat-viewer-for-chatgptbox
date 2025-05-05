// 导入所需的模块
// Import required modules
const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked'); // 用于 Markdown 渲染
                                     // For Markdown rendering

// 创建 Express 应用实例
// Create an Express application instance
const app = express();
// 定义端口号
// Define the port number
const PORT = 3000;

// 设置视图引擎为 EJS
// Set the view engine to EJS
app.set('view engine', 'ejs');
// 设置视图文件的存放目录
// Set the directory where view files are located
app.set('views', path.join(__dirname, 'views'));

// 用于提供静态文件（例如 CSS）
// To serve static files (e.g., CSS)
app.use(express.static(path.join(__dirname, 'public')));

// --- 数据加载 ---
// --- Data Loading ---
let sessionsData = [];
// 定义数据文件路径
// Define the data file path
const dataFilePath = path.join(__dirname, 'data.json');
try {
    // 读取并解析 JSON 数据文件
    // Read and parse the JSON data file
    const rawData = fs.readFileSync(dataFilePath, 'utf8');
    sessionsData = JSON.parse(rawData);
    // 确保数据是数组格式
    // Ensure data is in array format
    if (!Array.isArray(sessionsData)) {
        sessionsData = [sessionsData];
    }
    // 为每个会话添加一个唯一的 ID（如果 sessionId 不存在或不可靠）
    // Add a unique ID to each session (if sessionId is missing or unreliable)
    // 这里我们假设 sessionId 存在且唯一，如果不是，需要生成
    // Here we assume sessionId exists and is unique; generate if not
    sessionsData.forEach((session, index) => {
        if (!session.sessionId) {
            session.sessionId = `generated-id-${index}`; // 备用 ID
                                                         // Fallback ID
        }
        // 确保 conversationRecords 存在且是数组
        // Ensure conversationRecords exists and is an array
        if (!Array.isArray(session.conversationRecords)) {
            session.conversationRecords = [];
        }
    });
    console.log(`成功加载 ${sessionsData.length} 个会话记录。`);
    console.log(`Successfully loaded ${sessionsData.length} session records.`);
} catch (error) {
    // 处理文件读取或解析错误
    // Handle file reading or parsing errors
    console.error('无法加载或解析 data.json:', error);
    console.error('Could not load or parse data.json:', error);
}

// --- 辅助函数：高亮搜索词 ---
// --- Helper Function: Highlight Search Term ---
function highlight(text, query) {
    if (!query || !text) {
        return text;
    }
    // 使用正则表达式进行不区分大小写的替换
    // Use regex for case-insensitive replacement
    // 转义 query 中的特殊正则字符
    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// --- 路由定义 ---
// --- Route Definitions ---

// 路由：主页 - 显示所有聊天列表（支持全局搜索）
// Route: Homepage - Display list of all chats (supports global search)
app.get('/', (req, res) => {
    // 获取全局搜索查询参数
    // Get global search query parameter
    const globalSearchQuery = req.query.search || '';
    // 过滤后的会话数据
    // Filtered session data
    let filteredSessions = sessionsData;

    // 如果存在全局搜索查询，则过滤会话列表
    // If global search query exists, filter the session list
    if (globalSearchQuery) {
        const lowerCaseQuery = globalSearchQuery.toLowerCase();
        filteredSessions = sessionsData.filter(session => {
            // 检查会话名称或 ID 是否匹配
            // Check if session name or ID matches
            const nameMatch = (session.sessionName && session.sessionName.toLowerCase().includes(lowerCaseQuery)) ||
                              (session.sessionId && session.sessionId.toLowerCase().includes(lowerCaseQuery));
            // 检查此会话内的任何问答记录是否匹配
            // Check if any Q&A record within this session matches
            const recordsMatch = session.conversationRecords.some(record =>
                (record.question && record.question.toLowerCase().includes(lowerCaseQuery)) ||
                (record.answer && record.answer.toLowerCase().includes(lowerCaseQuery))
            );
            return nameMatch || recordsMatch;
        });
    }

    // 渲染主页视图
    // Render the homepage view
    res.render('index', {
        sessions: filteredSessions,
        searchQuery: globalSearchQuery,
        highlighter: highlight // 传递高亮函数
                               // Pass the highlight function
    });
});

// 路由：聊天详情页 - 显示单个聊天的记录（支持聊天内搜索）
// Route: Chat Detail Page - Display records of a single chat (supports in-chat search)
app.get('/chat/:sessionId', (req, res) => {
    // 获取会话 ID 参数
    // Get the session ID parameter
    const sessionId = req.params.sessionId;
    // 获取聊天内搜索查询参数
    // Get the in-chat search query parameter
    const chatSearchQuery = req.query.search || '';
    // 查找对应的会话
    // Find the corresponding session
    const session = sessionsData.find(s => s.sessionId === sessionId);

    // 如果找不到会话，显示 404 页面
    // If session not found, show a 404 page
    if (!session) {
        return res.status(404).send('Chat not found');
    }

    // 过滤当前会话的记录
    // Filter records of the current session
    let filteredRecords = session.conversationRecords;
    if (chatSearchQuery) {
        const lowerCaseQuery = chatSearchQuery.toLowerCase();
        filteredRecords = session.conversationRecords.filter(record =>
            (record.question && record.question.toLowerCase().includes(lowerCaseQuery)) ||
            (record.answer && record.answer.toLowerCase().includes(lowerCaseQuery))
        );
    }

    // 渲染聊天详情页视图
    // Render the chat detail page view
    res.render('chat', {
        session: session,
        records: filteredRecords,
        searchQuery: chatSearchQuery,
        markdownRenderer: marked, // 传递 Markdown 渲染器
                                  // Pass the Markdown renderer
        highlighter: highlight    // 传递高亮函数
                                  // Pass the highlight function
    });
});

// --- 启动服务器 ---
// --- Start Server ---
app.listen(PORT, () => {
    console.log(`服务器正在运行在 http://localhost:${PORT}`);
    console.log(`Server is running at http://localhost:${PORT}`);
});
