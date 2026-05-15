# Uniqlo China Price Watcher

用 Node.js + Playwright 模拟访问多个优衣库中国商品页，抓取价格，并在每天凌晨 00:00 和中午 12:00 检查一次。发现价格低于上一次记录时，会通过飞书机器人 webhook 发送降价通知。

程序自带一个 Web 管理页面，可以新增、删除监控商品，并查看最近一次抓取到的价格和错误信息。

## 使用

1. 安装依赖：

```bash
npm install
npx playwright install chromium
```

2. 创建 `.env`：

```bash
cp .env.example .env
```

把 `.env` 里的 `FEISHU_BOT_URL` 改成你的飞书机器人 webhook。

如果飞书机器人开启了“签名校验”，还需要填写 `FEISHU_BOT_SECRET`。

3. 配置商品：

编辑 `config/products.json`：

```json
[
  {
    "id": "uniqlo-001",
    "name": "商品名称",
    "url": "https://www.uniqlo.cn/..."
  }
]
```

`id` 用来保存历史价格，请保持稳定。

4. 手动跑一次：

```bash
npm run check
```

5. 启动定时任务：

```bash
npm start
```

打开管理页面：

```text
http://localhost:3000
```

历史价格会保存到 `data/price-state.json`。

## 配置项

- `FEISHU_BOT_URL`：飞书机器人 webhook。
- `FEISHU_BOT_SECRET`：飞书机器人签名密钥。机器人未开启签名校验时留空。
- `TIMEZONE`：默认 `Asia/Shanghai`。
- `HEADLESS`：默认 `true`。调试页面时可设为 `false`。
- `RUN_ON_START`：默认 `false`。设为 `true` 后启动程序会立刻检查一次。
- `PORT`：Web 管理页面端口，默认 `3000`。
- `PRODUCTS_FILE`：默认 `config/products.json`。
- `STATE_FILE`：默认 `data/price-state.json`。

## 管理页面

启动后访问 `http://localhost:3000`，可以直接添加类似下面的商品链接：

```text
https://www.uniqlo.cn/product-detail.html?productCode=u0000000069432
```

商品编号会自动从 `productCode` 提取，用于保存历史价格。

页面右上角的“测试飞书”按钮会发送一条测试消息，用来确认 `FEISHU_BOT_URL` 和 `FEISHU_BOT_SECRET` 是否配置正确。

## 注意

优衣库页面结构可能调整。如果抓取不到价格，可以先把 `HEADLESS=false`，运行 `npm run check` 观察页面，再按实际页面结构调整 `src/scraper.js` 里的选择器或解析逻辑。

## VPS 部署

下面以 Ubuntu/Debian VPS 为例。

1. 安装 Node.js 20+、PM2 和 Playwright 运行依赖：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. 上传项目到 VPS，例如 `/opt/uniqlo-price-watcher`：

```bash
sudo mkdir -p /opt/uniqlo-price-watcher
sudo chown -R $USER:$USER /opt/uniqlo-price-watcher
```

可以用 `git clone`、`scp` 或面板文件管理器上传本目录内容。

3. 安装项目依赖和 Chromium：

```bash
cd /opt/uniqlo-price-watcher
npm install
npx playwright install --with-deps chromium
```

如果你的 VPS 不是 root 用户，`--with-deps` 可能会要求 sudo 权限；也可以先执行 `sudo npx playwright install-deps chromium`。

4. 创建生产环境配置：

```bash
cp .env.production.example .env
nano .env
```

至少修改 `FEISHU_BOT_URL`。如果要改管理页面端口，修改 `PORT`。

如果飞书机器人安全设置里启用了“签名校验”，还要把密钥填到 `FEISHU_BOT_SECRET`：

```env
FEISHU_BOT_SECRET=你的签名密钥
```

5. 启动并设置开机自启：

```bash
npm run prod
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条带 `sudo` 的命令，把它复制执行一次。

常用维护命令：

```bash
pm2 status
pm2 logs uniqlo-price-watcher
pm2 restart uniqlo-price-watcher
pm2 stop uniqlo-price-watcher
```

更新代码后，让 PM2 重新加载最新代码：

```bash
git pull
npm install
npm run prod
pm2 save
```

如果页面看起来没变化，先确认 PM2 已重启，再在浏览器里强制刷新页面：

```bash
pm2 restart uniqlo-price-watcher
```

浏览器强制刷新一般是 `Ctrl + F5`，macOS Chrome/Safari 可用 `Command + Shift + R`。

6. 直接访问：

```text
http://你的VPS公网IP:3000
```

如果 VPS 开了防火墙，需要放行端口：

```bash
sudo ufw allow 3000/tcp
```

7. 推荐使用 Nginx 反向代理到域名：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

保存后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

8. 验证服务：

```bash
curl http://127.0.0.1:3000/healthz
npm run check
```

看到 `/healthz` 返回 `{"ok":true,...}`，并且 `npm run check` 能执行抓价，就说明部署基本完成。

## VPS 安全建议

管理页面现在没有登录鉴权。放到公网时，建议优先用 Nginx Basic Auth、只允许固定 IP 访问，或通过服务器防火墙限制端口来源。

一个简单的 Nginx Basic Auth 示例：

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/.uniqlo_price_watcher_htpasswd yourname
```

然后在 Nginx `location /` 里加：

```nginx
auth_basic "Uniqlo Price Watcher";
auth_basic_user_file /etc/nginx/.uniqlo_price_watcher_htpasswd;
```
