const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 中间件 ---
// 使用 Express 内置的 JSON 解析，不再需要 body-parser
app.use(express.json());
app.use(cors());

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 根目录返回 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 数据库初始化 ---
const db = new sqlite3.Database('./forum.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

// 创建表
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// --- API 路由 ---

// 注册
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`);
    stmt.run(username, hash, function (err) {
      if (err) {
        return res.status(400).json({ error: '用户名已存在' });
      }
      res.json({ success: true, user_id: this.lastID });
    });
    stmt.finalize();
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登录
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (!row) return res.status(400).json({ error: '用户名不存在' });

    try {
      const valid = await bcrypt.compare(password, row.password_hash);
      if (!valid) return res.status(400).json({ error: '密码错误' });

      res.json({
        success: true,
        user_id: row.id,
        username: row.username,
        points: row.points
      });
    } catch (e) {
      res.status(500).json({ error: '验证失败' });
    }
  });
});

// 发帖
app.post('/posts', (req, res) => {
  const { user_id, title, content } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: '缺少必要参数' });

  db.run(
    `INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)`,
    [user_id, title, content],
    function (err) {
      if (err) return res.status(500).json({ error: '发帖失败' });

      // 增加积分
      db.run(`UPDATE users SET points = points + 5 WHERE id = ?`, [user_id]);

      res.json({ success: true, post_id: this.lastID });
    }
  );
});

// 评论
app.post('/comments', (req, res) => {
  const { post_id, user_id, content } = req.body;
  if (!post_id || !user_id || !content) return res.status(400).json({ error: '缺少必要参数' });

  db.run(
    `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`,
    [post_id, user_id, content],
    function (err) {
      if (err) return res.status(500).json({ error: '评论失败' });

      // 增加积分
      db.run(`UPDATE users SET points = points + 2 WHERE id = ?`, [user_id]);

      res.json({ success: true, comment_id: this.lastID });
    }
  );
});

// 获取帖子列表
app.get('/posts', (req, res) => {
  const sql = `
    SELECT posts.*, users.username
    FROM posts
    JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: '获取帖子失败' });
    res.json(rows);
  });
});

// 获取帖子详情 + 评论
app.get('/posts/:id', (req, res) => {
  const postId = req.params.id;

  // 获取帖子信息
  db.get(
    `SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id = users.id WHERE posts.id = ?`,
    [postId],
    (err, post) => {
      if (err) return res.status(500).json({ error: '服务器错误' });
      if (!post) return res.status(404).json({ error: '帖子不存在' });

      // 获取评论
      db.all(
        `SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE post_id = ? ORDER BY created_at ASC`,
        [postId],
        (err, comments) => {
          if (err) return res.status(500).json({ error: '获取评论失败' });
          res.json({ post, comments });
        }
      );
    }
  );
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`RapidGear 论坛已启动，端口: ${PORT}`);
});
