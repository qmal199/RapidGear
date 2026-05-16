const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 关键修复：自动检查并创建数据文件 ---
const DATA_FILE = 'data.json';
if (!fs.existsSync(DATA_FILE)) {
    // 如果文件不存在，创建一个空的 JSON 文件，包含一个空数组 []
    fs.writeFileSync(DATA_FILE, '[]');
    console.log('✅ 自动创建了 data.json 文件');
}

// --- 配置 ---
app.set('view engine', 'ejs'); // 如果你没有 views 文件夹，这段可能会报错，建议先用纯 HTML 模式
app.use(express.static('public')); // 静态文件目录
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 内存缓存（为了性能，实际数据存文件）
let db = JSON.parse(fs.readFileSync(DATA_FILE));

// 图片上传配置 (存到内存，转 Base64)
const storage = multer.memoryStorage();
const upload = upload.single('image');

// --- 路由 ---

// 首页：显示所有帖子
app.get('/', (req, res) => {
    // 简单返回一个 HTML 字符串，防止找不到 index.html 报错
    let html = `<h1>汽车论坛</h1><a href="/post">我要发帖</a><hr>`;
    db.reverse().forEach(post => {
        html += `<div style="border:1px solid #ccc; margin:10px; padding:10px;">`;
        html += `<h3>${post.title}</h3>`;
        if (post.image) {
            html += `<img src="${post.image}" style="max-width:300px;"/>`;
        }
        html += `<p>${post.content}</p>`;
        html += `<hr></div>`;
    });
    res.send(html);
});

// 发帖页面 (简单表单)
app.get('/post', (req, res) => {
    let form = `<h1>发布新帖</h1>`;
    form += `<form action="/post" method="POST" enctype="multipart/form-data">`;
    form += `标题: <input name="title" required/><br/>`;
    form += `内容: <textarea name="content" required></textarea><br/>`;
    form += `图片: <input type="file" name="image" accept="image/*"/><br/>`;
    form += `<button type="submit">发布</button>`;
    form += `</form>`;
    res.send(form);
});

// 处理发帖
app.post('/post', (req, res) => {
    upload(req, res, function (err) {
        const newPost = {
            id: Date.now(),
            title: req.body.title,
            content: req.body.content,
            image: null
        };

        // 处理图片转 Base64
        if (req.file) {
            const base64String = Buffer.from(req.file.buffer).toString('base64');
            newPost.image = `data:${req.file.mimetype};base64,${base64String}`;
        }

        // 存入数组
        db.push(newPost);

        // 写入文件 (关键修复：确保写入成功)
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

        res.redirect('/');
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 服务器已启动，端口: ${PORT}`);
});
