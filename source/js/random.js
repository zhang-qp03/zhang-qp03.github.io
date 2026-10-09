// 保留首页“随机抽一篇文章”的入口；仅从文章索引选择。
window.toRandomPost = async function () {
    try {
        const response = await fetch('/search.json', { credentials: 'omit' });
        if (!response.ok) throw new Error('Unable to load article index');
        const records = await response.json();
        const posts = records.filter(item => item.path?.startsWith('/post/'));
        if (posts.length) location.assign(posts[Math.floor(Math.random() * posts.length)].path);
    } catch (error) {
        console.warn('随机文章暂时无法加载。', error);
    }
};
