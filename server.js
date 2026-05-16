const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 配置 ---
const DATA_FILE = 'data.json'; // 数据存在这个文件里

// 中间件：解析表单和JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public')); // 静态文件目录

// 配置 Multer：将图片保存在内存中（因为 Render 文件系统是临时的，我们转成 Base64 保存）
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 数据库逻辑 (简易版) ---
let db = { posts: [] };

// 启动时尝试读取数据
if (fs.existsSync(DATA_FILE)) {
    try {
        const data = fs.readFileSync(DATA_FILE);
        db = JSON.parse(data);
        console.log('数据加载成功');
    } catch (e) {
        console.log('数据文件损坏或为空，使用空数据库');
    }
}

// 保存数据到文件的函数
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// --- 路由 API ---

// 1. 获取所有帖子
app.get('/api/posts', (req, res) => {
    // 倒序排列，最新的在最前面
    res.json(db.posts.reverse());
});

// 2. 发布新帖子 (带图片)
app.post('/api/posts', upload.single('image'), (req, res) => {
    const { title, content, author } = req.body;
    
    let imageData = null;
    // 如果有上传图片，转为 Base64
    if (req.file) {
        imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const newPost = {
        id: Date.now(), // 简单的时间戳作为ID
        title,
        content,
        author: author || '匿名车友',
        image: imageData,
        date: new Date().toLocaleString('zh-CN')
    };

    db.posts.push(newPost);
    saveData(); // 写入文件
    res.redirect('/'); // 发布后回到首页
});

// --- 启动服务器 ---
app.listen(PORT, () => {
    console.log(`服务器正在运行，端口: ${PORT}`);
});
