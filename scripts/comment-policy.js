'use strict';

const { parse } = require('hexo-front-matter');

// Stellar 默认会在普通页面上显示评论。文章默认启用，独立页面需显式 comments: true。
// 仅调整渲染配置，不改写文章正文，也不修改主题子模块。
hexo.extend.filter.register('template_locals', function (locals) {
    const page = locals.page;
    if (page && page.layout !== 'post') {
        // Hexo 的 Page model 会自动补 comments: true，必须核对原始 front matter。
        page.comments = page.raw ? parse(page.raw).comments === true : page.comments === true;
    } else if (page && page.comments == null) {
        page.comments = true;
    }
    return locals;
});
