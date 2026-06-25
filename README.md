# AI手相大师（Palm Master AI）

一个可部署到 Vercel 的 Next.js MVP：用户上传或拍摄手掌照片，由 OpenAI Vision 观察可见掌纹，并以五种文化体系生成结构化娱乐解读。

## 本地运行

```bash
npm install
cp .env.example .env.local
```

在 `.env.local` 填入：

```bash
OPENAI_API_KEY=你的_OpenAI_API_Key
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_SITE_URL=https://你的域名
```

如果本地终端的 Node 无法继承 macOS 代理，可额外设置：

```bash
OPENAI_PROXY_URL=http://127.0.0.1:7890
```

该变量仅用于本地开发，部署到 Vercel 时不要配置。

然后运行：

```bash
npm run dev
```

打开 <http://localhost:3000>。

## 部署到 Vercel

1. 将本目录推送至 GitHub。
2. 在 Vercel 导入仓库。
3. 添加环境变量 `OPENAI_API_KEY`；可选添加 `OPENAI_MODEL`。
4. 添加 `NEXT_PUBLIC_SITE_URL`，填写正式域名。
5. 部署。

## 公开体验版能力

- 上传前拍摄指引和照片处理说明
- 分阶段分析进度与失败重试
- 掌纹辅助标注和五体系文化报告
- 不包含手掌照片的可下载分享海报
- 隐私说明、使用条款和基础频率限制

## 安全边界

- 照片仅通过服务端 API 发送给 OpenAI，本项目不保存图片或报告。
- 图片不清晰时要求重拍，不编造掌纹。
- 输出仅供传统文化参考、娱乐体验与自我探索。
- 不提供医疗、投资、婚姻或人生决策建议。
