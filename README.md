# Zhang Qingpeng's Personal Website

张青鹏的个人学术博客。

主要记录论文阅读、医学学习、算法笔记和科研实践。

基于 Hexo + Stellar 构建。

## 本地预览与发布

使用 Node.js 20。在首次拉取项目后执行：

```sh
git submodule update --init --recursive
npm ci
npx hexo clean
npx hexo generate
npm run verify
npm run server
```

源码推送到 `main` 后，`.github/workflows/deploy.yml` 自动构建并发布到
https://zhang-qp03.github.io/。也可以在 Actions 页面手动运行工作流。
GitHub 仓库 Settings → Pages → Source 应设为 **GitHub Actions**。
`npm run deploy` 仅推送源码到 `main`，不再向 `public` 分支推送生成文件。

## 评论

使用 Stellar 原生 Giscus，关联本仓库的 Announcements 分类，按 pathname 区分文章。
新文章默认启用评论；独立页面默认关闭，需要留言板时在页面 front matter 添加
`comments: true`。Giscus GitHub App 必须安装到本仓库，Discussions 必须启用。
首次留言或 Reaction 会创建对应的 Discussion。

右侧评论摘要和数量通过 Giscus 的公开只读接口获取，不保存 Token；若接口暂时
不可用，可直接使用文章底部的原生评论区。默认评论主题随系统明暗设置变化。

保留原有 Google/Baidu 验证文件、Vercel 配置及 Stellar 主题子模块来源。
确认不再使用相应服务后，再单独清理这些配置。
