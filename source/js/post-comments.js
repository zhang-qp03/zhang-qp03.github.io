(() => {
    'use strict';

    const panel = document.querySelector('.post-comments-window');
    const giscus = document.querySelector('#comments #giscus');
    if (!panel || !giscus) return;

    const list = panel.querySelector('.post-comments-list');
    const heading = panel.querySelector('#post-comments-heading');
    const refresh = panel.querySelector('.post-comments-refresh');
    let loading = false;
    let lastLoaded = 0;

    // 与 Giscus client.ts 的 pathname 映射一致，包括中文路径编码和去除扩展名。
    const term = location.pathname.length < 2
        ? 'index'
        : location.pathname.substring(1).replace(/\.\w+$/, '');

    function showStatus(message) {
        const status = document.createElement('p');
        status.className = 'post-comments-status';
        status.setAttribute('role', 'status');
        status.textContent = message;
        list.replaceChildren(status);
    }

    function renderComment(comment) {
        const item = document.createElement('article');
        item.className = 'post-comment';
        const meta = document.createElement('div');
        meta.className = 'post-comment-meta';
        const author = document.createElement('a');
        author.textContent = comment.author?.login || 'GitHub 用户';
        author.href = 'https://github.com/' + encodeURIComponent(comment.author?.login || '');
        author.target = '_blank';
        author.rel = 'noopener noreferrer';
        meta.appendChild(author);

        const date = new Date(comment.createdAt);
        if (!Number.isNaN(date.getTime())) {
            const time = document.createElement('time');
            time.dateTime = date.toISOString();
            time.textContent = date.toLocaleDateString('zh-CN');
            meta.appendChild(time);
        }
        const body = document.createElement('p');
        body.className = 'post-comment-text';
        // 侧栏继续只显示纯文本；格式化正文、回复和 Reaction 由原生 Giscus 展示。
        body.textContent = comment.bodyText || '';
        item.append(meta, body);
        return item;
    }

    async function loadComments() {
        if (loading) return;
        loading = true;
        refresh.disabled = true;
        list.setAttribute('aria-busy', 'true');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            // 同源公开索引由 Actions 更新，保留 data-emit-metadata: 0 和原生单 iframe。
            const response = await fetch('/comments.json', {
                credentials: 'omit', cache: 'no-store', signal: controller.signal
            });
            if (!response.ok) throw new Error('Comment index: ' + response.status);
            const data = await response.json();
            if (!data.available || data.repository !== giscus.dataset.repo || data.category !== giscus.dataset.category) {
                throw new Error('Comment index unavailable');
            }
            const discussion = data.discussions?.[term];
            if (!discussion) {
                heading.textContent = '评论（0）';
                showStatus('暂无评论，欢迎留下你的想法。');
                lastLoaded = Date.now();
                return;
            }
            if (!Array.isArray(discussion.comments)) throw new Error('Invalid comment index');
            const comments = discussion.comments.flatMap(comment => [comment, ...(comment.replies || [])]);
            const totalComments = discussion.totalCommentCount;
            const totalReplies = discussion.totalReplyCount;

            comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            heading.textContent = '评论（' + (totalComments + totalReplies) + '）';
            if (comments.length) list.replaceChildren(...comments.map(renderComment));
            else showStatus('暂无评论，欢迎留下你的想法。');
            lastLoaded = Date.now();
        } catch (error) {
            if (!list.querySelector('.post-comment')) {
                showStatus('评论暂时无法加载，请点击刷新重试，或查看文章底部的评论区。');
            } else {
                const status = document.createElement('p');
                status.className = 'post-comments-status';
                status.setAttribute('role', 'status');
                status.textContent = '刷新失败，已保留当前评论，请稍后重试。';
                list.querySelector('.post-comments-status')?.remove();
                list.prepend(status);
            }
        } finally {
            clearTimeout(timeout);
            loading = false;
            refresh.disabled = false;
            list.setAttribute('aria-busy', 'false');
        }
    }

    refresh.addEventListener('click', loadComments);
    window.addEventListener('focus', () => {
        if (Date.now() - lastLoaded > 60000) loadComments();
    });
    // iframe 发回尺寸变化时，留言或回复可能已更新；限制请求频率。
    window.addEventListener('message', event => {
        if (event.origin !== 'https://giscus.app') return;
        const iframe = document.querySelector('#comments iframe.giscus-frame');
        if (!iframe || event.source !== iframe.contentWindow || !event.data?.giscus) return;
        if (Date.now() - lastLoaded > 30000) loadComments();
    });
    loadComments();
})();
