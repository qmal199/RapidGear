// ===== RapidGear - Vercel 专用 server.js =====
// 直接用此文件完整替换你 GitHub 仓库中的 server.js

const express = require('express');
const path = require('path');

const app = express();

// ===== 中间件 =====
app.use(express.json());

// 静态文件目录（public 文件夹）
app.use(express.static(path.join(__dirname, 'public')));

// ===== 内存数据（Vercel 兼容，不使用 sqlite3）=====
const users = [];
const posts = [];
const comments = [];

// ===== 首页 =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== 注册 =====
app.post('/register', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      error: '用户名和密码不能为空'
    });
  }

  const exists = users.find(u => u.username === username);
  if (exists) {
    return res.status(400).json({
      error: '用户名已存在'
    });
  }

  const user = {
    id: users.length + 1,
    username,
    password, // 演示用途；正式环境建议加密
    points: 0,
    created_at: new Date().toISOString()
  };

  users.push(user);

  res.json({
    success: true,
    user_id: user.id
  });
});

// ===== 登录 =====
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(400).json({
      error: '用户名或密码错误'
    });
  }

  res.json({
    success: true,
    user_id: user.id,
    username: user.username,
    points: user.points
  });
});

// ===== 发帖 =====
app.post('/posts', (req, res) => {
  const { user_id, title, content } = req.body || {};

  if (!user_id || !title || !content) {
    return res.status(400).json({
      error: '参数不完整'
    });
  }

  const user = users.find(u => u.id == user_id);
  if (!user) {
    return res.status(400).json({
      error: '用户不存在'
    });
  }

  const post = {
    id: posts.length + 1,
    user_id: Number(user_id),
    username: user.username,
    title,
    content,
    created_at: new Date().toISOString()
  };

  // 新帖子放到最前面
  posts.unshift(post);

  // 发帖奖励积分
  user.points += 5;

  res.json({
    success: true,
    post_id: post.id
  });
});

// ===== 评论 =====
app.post('/comments', (req, res) => {
  const { post_id, user_id, content } = req.body || {};

  if (!post_id || !user_id || !content) {
    return res.status(400).json({
      error: '参数不完整'
    });
  }

  const user = users.find(u => u.id == user_id);
  if (!user) {
    return res.status(400).json({
      error: '用户不存在'
    });
  }

  const post = posts.find(p => p.id == post_id);
  if (!post) {
    return res.status(400).json({
      error: '帖子不存在'
    });
  }

  const comment = {
    id: comments.length + 1,
    post_id: Number(post_id),
    user_id: Number(user_id),
    username: user.username,
    content,
    created_at: new Date().toISOString()
  };

  comments.push(comment);

  // 评论奖励积分
  user.points += 2;

  res.json({
    success: true,
    comment_id: comment.id
  });
});

// ===== 获取帖子列表 =====
app.get('/posts', (req, res) => {
  res.json(posts);
});

// ===== 获取帖子详情 + 评论 =====
app.get('/posts/:id', (req, res) => {
  const postId = Number(req.params.id);

  const post = posts.find(p => p.id === postId);

  if (!post) {
    return res.status(404).json({
      error: '帖子不存在'
    });
  }

  const postComments = comments.filter(
    c => c.post_id === postId
  );

  res.json({
    post,
    comments: postComments
  });
});

// ===== Vercel 必须使用 module.exports =====
module.exports = app;