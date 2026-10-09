(() => {
    'use strict';

    const page = document.querySelector('.l_body[layout="post"]');
    if (!page) return;

    const main = page.querySelector('.l_main');
    const rightbar = page.querySelector('.l_right');
    if (!main || !rightbar || main.querySelector('.post-actions')) return;

    const actions = document.createElement('nav');
    actions.className = 'post-actions';
    actions.setAttribute('aria-label', '文章导航');
    actions.innerHTML = `
        <a class="post-back" href="/">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 12H5m7-7-7 7 7 7"/>
            </svg>
            <span>返回</span>
        </a>
    `;
    main.prepend(actions);

    const back = actions.querySelector('.post-back');
    const entryUrl = location.href;
    const previous = document.referrer ? new URL(document.referrer) : null;
    const canReturn = previous?.origin === location.origin && previous.pathname !== location.pathname;
    if (canReturn) back.href = previous.href;

    back.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        // 目录锚点会新增浏览历史，此时直接返回来源页，避免退到文章内的上一小节。
        if (canReturn && history.length > 1 && location.href === entryUrl) {
            event.preventDefault();
            history.back();
        }
    });

    let widgets = rightbar.querySelector('.widgets');
    if (!widgets) {
        widgets = document.createElement('div');
        widgets.className = 'widgets';
        rightbar.appendChild(widgets);
    }

    const top = document.createElement('widget');
    top.className = 'widget-wrapper post-scroll-top';
    top.innerHTML = `
        <div class="widget-body">
            <button class="post-top-button" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 19V5m-7 7 7-7 7 7"/>
                </svg>
                <span>回到顶部</span>
            </button>
        </div>
    `;
    top.querySelector('button').addEventListener('click', () => {
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
    });

    let toc = widgets.querySelector('#data-toc');
    if (!toc) {
        toc = document.createElement('widget');
        toc.id = 'data-toc';
        toc.className = 'widget-wrapper toc';
        toc.innerHTML = `
            <div class="widget-header"><span class="name">本文目录</span></div>
            <div class="widget-body"><p class="post-sidebar-note">这篇文章暂无小节目录。</p></div>
        `;
    }
    toc.classList.add('post-toc-panel');
    toc.querySelector('.widget-footer')?.remove();

    const toggle = toc.querySelector('.cap-action');
    if (toggle) {
        toggle.removeAttribute('onclick');
        toggle.setAttribute('href', '#');
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('aria-label', '折叠或展开本文目录');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.addEventListener('click', event => {
            event.preventDefault();
            const collapsed = toc.classList.toggle('collapse');
            toggle.setAttribute('aria-expanded', String(!collapsed));
        });
        toggle.addEventListener('keydown', event => {
            if (event.key === ' ') {
                event.preventDefault();
                toggle.click();
            }
        });
    }

    const discussion = document.createElement('widget');
    discussion.className = 'widget-wrapper post-discussion-panel';
    discussion.innerHTML = `
        <div class="widget-header"><span class="name">参与讨论</span></div>
        <div class="widget-body post-discussion-body"></div>
    `;
    const discussionBody = discussion.querySelector('.widget-body');
    const comments = main.querySelector('#comments');
    if (comments) {
        discussionBody.appendChild(comments);
    } else {
        const discussionActions = document.createElement('div');
        discussionActions.className = 'post-discussion-actions';
        discussionBody.appendChild(discussionActions);

        const title = main.querySelector('h1')?.textContent.trim() || document.title;
        const articleUrl = document.querySelector('meta[property="og:url"]')?.content || location.href;
        const issueUrl = document.currentScript?.dataset.discussionUrl;
        if (issueUrl) {
            const url = new URL(issueUrl);
            url.searchParams.set('title', `讨论：${title}`);
            url.searchParams.set('body', `文章：${title}\n链接：${articleUrl}\n\n想法或问题：\n`);
            const link = document.createElement('a');
            link.className = 'post-discussion-link';
            link.dataset.commentEntry = '';
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'GitHub 留言';
            discussionActions.appendChild(link);
        }

        const email = document.querySelector('.social-wrap a[href^="mailto:"]')?.getAttribute('href');
        if (email) {
            const url = new URL(email);
            url.searchParams.set('subject', `关于文章：${title}`);
            url.searchParams.set('body', `文章链接：${articleUrl}\n\n`);
            const link = document.createElement('a');
            link.className = 'post-discussion-link';
            link.href = url.href;
            link.textContent = '邮件交流';
            discussionActions.appendChild(link);
        }

        const commentWindow = document.createElement('section');
        commentWindow.className = 'post-comments-window';
        commentWindow.setAttribute('aria-labelledby', 'post-comments-heading');
        commentWindow.dataset.articleUrl = articleUrl;
        // 评论仓库与留言入口保持一致，不需要在前端保存任何访问令牌。
        const repo = issueUrl && new URL(issueUrl).pathname.match(/^\/([^/]+\/[^/]+)\/issues\/new\/?$/)?.[1];
        if (repo) commentWindow.dataset.repo = repo;
        commentWindow.innerHTML = `
            <div class="post-comments-header">
                <span id="post-comments-heading">评论</span>
                <button class="post-comments-refresh" type="button" aria-label="刷新评论">刷新</button>
            </div>
            <div class="post-comments-list" tabindex="0" role="region" aria-label="读者评论">
                <p class="post-comments-status" role="status">正在加载评论…</p>
            </div>
        `;
        discussionBody.appendChild(commentWindow);
    }

    widgets.replaceChildren(top, toc, discussion);
    rightbar.classList.add('post-sidebar');
})();
