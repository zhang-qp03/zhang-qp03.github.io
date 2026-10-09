import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const root = process.cwd();
const output = path.join(root, 'public');
const config = yaml.load(readFileSync('_config.yml', 'utf8'));
const stellar = yaml.load(readFileSync('_config.stellar.yml', 'utf8'));
assert.equal(config.title, 'zhangqp');
assert.equal(config.url, 'https://zhang-qp03.github.io');
assert.equal(config.root, '/');
assert.equal(config.theme, 'stellar');
assert.deepEqual(config.deploy, []);
assert.equal(stellar.comments.service, 'giscus');
assert.ok(existsSync(path.join(output, 'index.html')), 'Homepage was not generated');
const commentIndex = JSON.parse(readFileSync(path.join(output, 'comments.json'), 'utf8'));
assert.equal(commentIndex.repository, stellar.comments.giscus['data-repo']);
assert.equal(commentIndex.category, stellar.comments.giscus['data-category']);
for (const discussion of Object.values(commentIndex.discussions)) {
    assert.equal(discussion.totalCommentCount, discussion.comments.length);
    assert.equal(discussion.totalReplyCount, discussion.comments.reduce((sum, comment) => sum + comment.replies.length, 0));
}
if (process.env.CI) assert.equal(commentIndex.available, true, 'Comments export was not completed');

const expected = {
    'data-repo': 'zhang-qp03/zhang-qp03.github.io',
    'data-repo-id': 'R_kgDOVCIOXA',
    'data-category': 'Announcements',
    'data-category-id': 'DIC_kwDOVCIOXM4DHaAL',
    'data-mapping': 'pathname',
    'data-strict': '0',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'bottom',
    'data-theme': 'preferred_color_scheme',
    'data-lang': 'zh-CN',
    'data-loading': 'lazy',
    crossorigin: 'anonymous'
};
for (const [key, value] of Object.entries(expected)) {
    assert.equal(String(stellar.comments.giscus[key]), value, 'Giscus config: ' + key);
}

function attributes(tag) {
    return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const name = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(name) : [name];
    });
}

const missingAssets = new Set();
let postCount = 0;
const htmlFiles = walk(output).filter(file => file.endsWith('.html'));
for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const relative = path.relative(output, file).replaceAll(path.sep, '/');
    const containers = [...html.matchAll(/<div\b[^>]*>/g)]
        .map(match => attributes(match[0])).filter(attrs => attrs.id === 'giscus');
    if (relative.startsWith('post/')) {
        postCount++;
        assert.equal(containers.length, 1, relative + ': expected one native Giscus container');
        assert.equal(containers[0].src, 'https://giscus.app/client.js');
        for (const [key, value] of Object.entries(expected)) {
            assert.equal(containers[0][key], value, relative + ': rendered Giscus ' + key);
        }
        assert.equal((html.match(/https:\/\/giscus\.app\/client\.js/g) || []).length, 1,
            relative + ': duplicate Giscus client loader');
    } else {
        // 独立页面若显式开启评论（如留言板），允许使用自己的 pathname Discussion。
        const pageSource = path.join(root, 'source', relative.replace(/\.html$/, '.md'));
        const frontmatter = existsSync(pageSource)
            ? readFileSync(pageSource, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)
            : null;
        const optedIn = frontmatter && yaml.load(frontmatter[1])?.comments === true;
        assert.equal(containers.length, optedIn ? 1 : 0, relative + ': unexpected comments');
    }

    for (const match of html.matchAll(/<(?:script|img|link)\b[^>]*>/g)) {
        const attrs = attributes(match[0]);
        const resource = attrs.src || (attrs.rel === 'stylesheet' ? attrs.href : null);
        if (!resource || /^(?:https?:|\/\/|data:|#)/.test(resource)) continue;
        const url = new URL(resource, 'https://zhang-qp03.github.io/' + relative);
        const asset = path.join(output, decodeURIComponent(url.pathname).slice(1));
        if (!existsSync(asset) || !statSync(asset).isFile()) missingAssets.add(url.pathname);
    }
}
assert.ok(postCount > 0, 'No article pages were generated');
assert.deepEqual([...missingAssets], [], 'Missing local CSS, JavaScript or images');

let commentPolicy;
vm.runInNewContext(readFileSync('scripts/comment-policy.js', 'utf8'), {
    require,
    hexo: { extend: { filter: { register: (_name, callback) => { commentPolicy = callback; } } } }
});
for (const [layout, initial, result] of [
    ['post', undefined, true], ['page', undefined, false], ['index', undefined, false],
    ['page', true, true], ['post', false, false]
]) {
    assert.equal(commentPolicy({ page: { layout, comments: initial } }).page.comments, result);
}
assert.equal(commentPolicy({ page: { layout: 'page', comments: true, raw: '---\ntitle: About\n---\nAbout' } }).page.comments, false);
assert.equal(commentPolicy({ page: { layout: 'page', comments: true, raw: '---\ncomments: true\n---\nGuestbook' } }).page.comments, true);

const workflow = yaml.load(readFileSync('.github/workflows/deploy.yml', 'utf8'));
assert.deepEqual(workflow.on.push.branches, ['main']);
assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
assert.ok(workflow.on.discussion_comment.types.includes('created'));
assert.equal(workflow.permissions.discussions, 'read');
assert.equal(workflow.permissions.contents, 'read');
assert.equal(workflow.permissions.pages, 'write');
assert.equal(workflow.permissions['id-token'], 'write');
assert.equal(workflow.jobs.build.steps.find(step => step.uses?.startsWith('actions/checkout@')).with.submodules, 'recursive');
assert.equal(workflow.jobs.build.steps.find(step => step.uses?.startsWith('actions/setup-node@')).with['node-version'], '20');
assert.equal(workflow.jobs.build.steps.find(step => step.uses?.startsWith('actions/upload-pages-artifact@')).with.path, 'public');
console.log('Verified ' + htmlFiles.length + ' HTML pages, ' + postCount + ' article(s), Giscus settings, comment policy, assets and Pages workflow.');
