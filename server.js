require('dotenv').config(); // 務必在最上方載入
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080; // 優先使用 .env 中的 PORT
const ROOT_DIR = __dirname;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url).pathname;
    
    // --- 新增：處理 API 請求，回傳 .env 配置 ---
    if (parsedUrl === '/api/config') {
        const config = {
            RPC_URL: process.env.RPC_URL || 'http://127.0.0.1:8545',
            PRIVATE_KEY: process.env.PRIVATE_KEY
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(config));
        return;
    }

    // --- 原始檔案服務邏輯 ---
    let filePath = (parsedUrl === '/' || parsedUrl === '/index.html') 
        ? '/user-dapp/index.html' 
        : parsedUrl;

    const fullPath = path.join(ROOT_DIR, filePath);

    // 防止穿越攻擊
    if (!fullPath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = String(path.extname(fullPath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(fullPath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });

}).listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/`);
    console.log(`🔗 Config API: http://localhost:${PORT}/api/config`);
});