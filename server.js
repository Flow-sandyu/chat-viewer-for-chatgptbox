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

// --- 中间件 ---
// --- Middleware ---
// 添加 express.json() 中间件来解析 JSON 请求体，设置较大的限制以处理可能的大型 JSON 文件
// Add express.json() middleware to parse JSON request bodies, setting a larger limit for potentially large JSON files
app.use(express.json({ limit: '50mb' })); // 限制 50MB，根据需要调整
                                          // Limit 50MB, adjust as needed
// 添加 express.urlencoded() 中间件来解析 URL 编码的请求体（虽然此应用主要用 JSON，但加上无妨）
// Add express.urlencoded() middleware to parse URL-encoded request bodies (though this app mainly uses JSON, it doesn't hurt)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 设置视图引擎为 EJS
// Set the view engine to EJS
app.set('view engine', 'ejs');
// 设置视图文件的存放目录
// Set the directory where view files are located
app.set('views', path.join(__dirname, 'views'));

// 用于提供静态文件（例如 CSS, 客户端 JS）
// To serve static files (e.g., CSS, client-side JS)
app.use(express.static(path.join(__dirname, 'public')));

// --- 数据存储 (内存) ---
// --- Data Storage (In-Memory) ---
let sessionsData = []; // 初始化为空，等待上传或初始加载
                       // Initialize as empty, waiting for upload or initial load

// --- 可选：初始加载 data.json (如果文件存在) ---
// --- Optional: Initial loading of data.json (if file exists) ---
const dataFilePath = path.join(__dirname, 'data.json');
try {
    if (fs.existsSync(dataFilePath)) {
        const rawData = fs.readFileSync(dataFilePath, 'utf8');
        const initialData = JSON.parse(rawData);
        if (Array.isArray(initialData)) {
            sessionsData = initialData;
        } else {
            sessionsData = [initialData]; // 保证是数组
                                          // Ensure it's an array
        }
        // (可以保留之前的 sessionId 和 conversationRecords 格式化逻辑)
        // (Can keep the previous sessionId and conversationRecords formatting logic)
        sessionsData.forEach((session, index) => {
             if (!session.sessionId) {
                 session.sessionId = `generated-id-${index}`;
             }
             if (!Array.isArray(session.conversationRecords)) {
                 session.conversationRecords = [];
             }
         });
        console.log(`从 data.json 初始加载了 ${sessionsData.length} 个会话记录。`);
        console.log(`Initially loaded ${sessionsData.length} session records from data.json.`);
    } else {
        console.log('未找到初始 data.json 文件，等待用户上传。');
        console.log('Initial data.json file not found, waiting for user upload.');
    }
} catch (error) {
    console.error('初始加载 data.json 失败:', error);
    console.error('Failed to initially load data.json:', error);
}


// --- 辅助函数：高亮搜索词 ---
// --- Helper Function: Highlight Search Term ---
function highlight(text, query) {
    if (!query || !text) {
        return text;
    }
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// --- 路由定义 ---
// --- Route Definitions ---

// 路由：主页 - 显示聊天列表（或上传提示）
// Route: Homepage - Display chat list (or upload prompt)
app.get('/', (req, res) => {
    const globalSearchQuery = req.query.search || '';
    let filteredSessions = sessionsData;

    if (globalSearchQuery && sessionsData.length > 0) {
        const lowerCaseQuery = globalSearchQuery.toLowerCase();
        // (过滤逻辑保持不变)
        // (Filtering logic remains the same)
        filteredSessions = sessionsData.filter(function(session) { // 使用传统函数
            const nameMatch = (session.sessionName && session.sessionName.toLowerCase().includes(lowerCaseQuery)) ||
                              (session.sessionId && session.sessionId.toLowerCase().includes(lowerCaseQuery));
            const recordsMatch = session.conversationRecords.some(function(record) { // 使用传统函数
                return (record.question && record.question.toLowerCase().includes(lowerCaseQuery)) ||
                       (record.answer && record.answer.toLowerCase().includes(lowerCaseQuery));
            });
            return nameMatch || recordsMatch;
        });
    }

    // 渲染主页视图
    // Render the homepage view
    res.render('index', {
        sessions: filteredSessions, // 可能是空数组
                                    // Might be an empty array
        hasData: sessionsData.length > 0, // 传递一个标志指示是否有数据
                                          // Pass a flag indicating if there's data
        searchQuery: globalSearchQuery,
        highlighter: highlight
    });
});

// 路由：聊天详情页
// Route: Chat Detail Page
app.get('/chat/:sessionId', (req, res) => {
    // (聊天详情页逻辑保持不变)
    // (Chat detail page logic remains the same)
    const sessionId = req.params.sessionId;
    const chatSearchQuery = req.query.search || '';
    const session = sessionsData.find(s => s.sessionId === sessionId);

    if (!session) {
        // 如果没有数据或找不到会话，可以重定向回主页提示上传
        // If no data or session not found, can redirect to homepage with upload prompt
        return res.redirect('/?message=Chat not found or no data loaded');
    }

    let filteredRecords = session.conversationRecords;
    if (chatSearchQuery) {
        const lowerCaseQuery = chatSearchQuery.toLowerCase();
        filteredRecords = session.conversationRecords.filter(function(record) { // 使用传统函数
            return (record.question && record.question.toLowerCase().includes(lowerCaseQuery)) ||
                   (record.answer && record.answer.toLowerCase().includes(lowerCaseQuery));
        });
    }

    res.render('chat', {
        session: session,
        records: filteredRecords,
        searchQuery: chatSearchQuery,
        markdownRenderer: marked,
        highlighter: highlight
    });
});

// 新路由：处理文件上传
// New Route: Handle file upload
app.post('/upload', (req, res) => {
    try {
        // req.body 应该是由客户端发送并由 express.json() 解析的 JSON 数据
        // req.body should be the JSON data sent by the client and parsed by express.json()
        const uploadedData = req.body;

        // 基本验证：检查是否为数组
        // Basic validation: Check if it's an array
        if (!Array.isArray(uploadedData)) {
             // 如果不是数组，尝试看它是否是包含 records 的单个对象
             // If not an array, try seeing if it's a single object containing records
             if (uploadedData && Array.isArray(uploadedData.conversationRecords)) {
                 sessionsData = [uploadedData]; // 将单个对象包装成数组
                                                // Wrap the single object in an array
             } else {
                 throw new Error('Uploaded data is not a valid session array or object.');
             }
        } else {
             sessionsData = uploadedData; // 更新内存中的数据
                                          // Update in-memory data
        }

        // (可以再次运行格式化逻辑)
        // (Can run formatting logic again)
        sessionsData.forEach((session, index) => {
             if (!session.sessionId) {
                 session.sessionId = `generated-id-${index}`;
             }
             if (!Array.isArray(session.conversationRecords)) {
                 session.conversationRecords = [];
             }
         });

        console.log(`成功接收并加载了 ${sessionsData.length} 个会话记录。`);
        console.log(`Successfully received and loaded ${sessionsData.length} session records.`);
        // 发送成功响应给客户端
        // Send success response to the client
        res.status(200).json({ message: 'File uploaded and processed successfully.' });

    } catch (error) {
        console.error('处理上传数据时出错:', error);
        console.error('Error processing uploaded data:', error);
        // 发送错误响应给客户端
        // Send error response to the client
        res.status(400).json({ message: 'Error processing uploaded file. Ensure it is valid JSON.', error: error.message });
    }
});


// --- 启动服务器 ---
// --- Start Server ---
app.listen(PORT, () => {
    console.log(`服务器正在运行在 http://localhost:${PORT}`);
    console.log(`Server is running at http://localhost:${PORT}`);
});