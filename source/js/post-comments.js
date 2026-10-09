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
        const template = document.createElement('template');
        template.innerHTML = comment.bodyHTML || '';
        body.textContent = template.content.textContent;
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
            // Giscus 自己的公开读取接口，无需在浏览器中保存 GitHub Token。
            // 保留 data-emit-metadata: 0，不另外注入 client.js 或创建评论 iframe。
            const url = new URL('https://giscus.app/api/discussions');
            url.searchParams.set('repo', giscus.dataset.repo);
            url.searchParams.set('category', giscus.dataset.category);
            url.searchParams.set('term', term);
            url.searchParams.set('strict', String(giscus.dataset.strict === '1'));
            url.searchParams.set('first', '100');
            const comments = [];
            let totalComments = 0;
            let totalReplies = 0;
            let hasNextPage;
            do {
                const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
                const data = await response.json();
                if (response.status === 404 && data.error === 'Discussion not found') {
                    heading.textContent = '评论（0）';
                    showStatus('暂无评论，欢迎留下你的想法。');
                    lastLoaded = Date.now();
                    return;
                }
                if (!response.ok) throw new Error('Giscus: ' + response.status);
                const discussion = data.discussion;
                if (!discussion || !Array.isArray(discussion.comments)) {
                    throw new Error('Invalid discussion response');
                }
                totalComments = discussion.totalCommentCount;
                for (const comment of discussion.comments) {
                    totalReplies += comment.replyCount || 0;
                    comments.push(comment, ...(comment.replies || []));
                }
                hasNextPage = discussion.pageInfo?.hasNextPage;
                if (hasNextPage) {
                    if (!discussion.pageInfo.endCursor) throw new Error('Missing comment cursor');
                    url.searchParams.set('after', discussion.pageInfo.endCursor);
                }
            } while (hasNextPage);

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
