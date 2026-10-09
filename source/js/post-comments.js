(() => {
    'use strict';

    const panel = document.querySelector('.post-comments-window');
    if (!panel) return;

    const list = panel.querySelector('.post-comments-list');
    const heading = panel.querySelector('#post-comments-heading');
    const refresh = panel.querySelector('.post-comments-refresh');
    const entry = document.querySelector('[data-comment-entry]');
    const repo = panel.dataset.repo;
    const articlePath = new URL(panel.dataset.articleUrl).pathname;
    let loading = false;
    let lastLoaded = 0;

    function showStatus(message) {
        const status = document.createElement('p');
        status.className = 'post-comments-status';
        status.setAttribute('role', 'status');
        status.textContent = message;
        list.replaceChildren(status);
    }

    async function getPages(url, signal, key) {
        const records = [];
        while (url) {
            const response = await fetch(url, {
                headers: { Accept: 'application/vnd.github.full+json' },
                credentials: 'omit',
                signal
            });
            if (!response.ok) throw new Error(`GitHub: ${response.status}`);
            const data = await response.json();
            if (data.incomplete_results) throw new Error('Incomplete comment search');
            const page = key ? data[key] : data;
            if (!Array.isArray(page)) throw new Error('Invalid comment response');
            records.push(...page);
            url = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
        }
        return records;
    }

    function renderComment(comment) {
        const item = document.createElement('article');
        item.className = 'post-comment';
        const meta = document.createElement('div');
        meta.className = 'post-comment-meta';
        const author = document.createElement('a');
        author.textContent = comment.user?.login || 'GitHub 用户';
        author.href = `https://github.com/${encodeURIComponent(comment.user?.login || '')}`;
        author.target = '_blank';
        author.rel = 'noopener noreferrer';
        meta.appendChild(author);

        const date = new Date(comment.created_at);
        if (!Number.isNaN(date.getTime())) {
            const time = document.createElement('time');
            time.dateTime = date.toISOString();
            time.textContent = date.toLocaleDateString('zh-CN');
            meta.appendChild(time);
        }
        const body = document.createElement('p');
        body.className = 'post-comment-text';
        // 留言作为纯文本显示，保留换行，避免将用户内容作为 HTML 执行。
        body.textContent = comment.body_text ?? comment.body ?? '';
        item.append(meta, body);
        return item;
    }

    async function loadComments() {
        if (loading) return;
        if (!repo) {
            showStatus('评论暂未开放。');
            refresh.hidden = true;
            return;
        }
        loading = true;
        refresh.disabled = true;
        list.setAttribute('aria-busy', 'true');
        if (!list.querySelector('.post-comment')) showStatus('正在加载评论…');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const search = new URL('https://api.github.com/search/issues');
            search.searchParams.set('q', `repo:${repo} is:issue in:body "${articlePath}"`);
            search.searchParams.set('sort', 'created');
            search.searchParams.set('order', 'asc');
            search.searchParams.set('per_page', '100');
            const issues = (await getPages(search.href, controller.signal, 'items'))
                .filter(issue => !issue.pull_request && issue.body?.includes(articlePath));
            const comments = [];
            for (const issue of issues) {
                if (!Number.isSafeInteger(issue.number)) continue;
                // 第一条留言在 Issue 正文里，移除创建入口自动填写的文章信息。
                const issueBody = issue.body.replace(/\r\n/g, '\n');
                const marker = '\n\n想法或问题：\n';
                const markerIndex = issueBody.indexOf(marker);
                const body = markerIndex >= 0 ? issueBody.slice(markerIndex + marker.length).trim() : issueBody.trim();
                if (body) comments.push({ ...issue, body, body_text: markerIndex >= 0 ? body : issue.body_text });
                const url = `https://api.github.com/repos/${repo}/issues/${issue.number}/comments?per_page=100`;
                comments.push(...await getPages(url, controller.signal));
            }
            if (issues.length && entry) {
                // 已有讨论时直接进入同一主题，避免后续读者重复创建。
                entry.href = `https://github.com/${repo}/issues/${issues[0].number}`;
            }
            comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            heading.textContent = `评论（${comments.length}）`;
            if (comments.length) {
                list.replaceChildren(...comments.map(renderComment));
            } else {
                showStatus('暂无评论，欢迎留下你的想法。');
            }
            lastLoaded = Date.now();
        } catch (error) {
            if (!list.querySelector('.post-comment')) showStatus('评论暂时无法加载，请点击刷新重试。');
            else {
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
    // 从 GitHub 留言后返回网页时更新列表，短时间切换窗口不会重复请求。
    window.addEventListener('focus', () => {
        if (Date.now() - lastLoaded > 60000) loadComments();
    });
    loadComments();
})();
