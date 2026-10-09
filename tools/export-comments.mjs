import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const config = yaml.load(readFileSync('_config.yml', 'utf8'));
const giscus = yaml.load(readFileSync('_config.stellar.yml', 'utf8')).comments.giscus;
const [owner, name] = giscus['data-repo'].split('/');
const category = giscus['data-category-id'];
const token = process.env.GH_TOKEN;
const output = { repository: giscus['data-repo'], category: giscus['data-category'], available: true, generatedAt: new Date().toISOString(), discussions: {} };

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(file) : [file];
    });
}
const terms = new Set();
for (const file of walk('public').filter(file => file.endsWith('.html'))) {
    if (!/<div\b[^>]*id="giscus"/.test(readFileSync(file, 'utf8'))) continue;
    const relative = path.relative('public', file).replaceAll(path.sep, '/');
    const pathname = new URL('/' + relative, config.url).pathname;
    terms.add(pathname.substring(1).replace(/\.\w+$/, ''));
    if (relative.endsWith('index.html')) terms.add(pathname.slice(1, -10) || 'index');
}

async function graphql(query, variables) {
    const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'zhangqp-comments-export' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30000)
    });
    const result = await response.json();
    if (!response.ok || result.errors?.length) throw new Error(result.errors?.map(error => error.message).join('; ') || 'GitHub API: ' + response.status);
    return result.data;
}

const replyFields = 'id bodyText createdAt author { login }';
const commentFields = replyFields + ' replies(first: 100) { totalCount pageInfo { hasNextPage endCursor } nodes { ' + replyFields + ' } }';
async function connection(id, kind, cursor) {
    const type = kind === 'comments' ? 'Discussion' : 'DiscussionComment';
    const fields = kind === 'comments' ? commentFields : replyFields;
    const query = 'query($id: ID!, $cursor: String) { node(id: $id) { ... on ' + type + ' { ' + kind + '(first: 100, after: $cursor) { totalCount pageInfo { hasNextPage endCursor } nodes { ' + fields + ' } } } } }';
    const result = await graphql(query, { id, cursor });
    return result.node[kind];
}
async function allNodes(id, kind, first) {
    let page = first || await connection(id, kind, null);
    const totalCount = page.totalCount;
    const nodes = [...page.nodes];
    while (page.pageInfo.hasNextPage) {
        assert.ok(page.pageInfo.endCursor, 'Missing discussion cursor');
        page = await connection(id, kind, page.pageInfo.endCursor);
        nodes.push(...page.nodes);
    }
    assert.equal(nodes.length, totalCount, 'Incomplete ' + kind + ' export');
    return nodes;
}

if (!token) {
    // 本地预览可以使用已经发布的公开索引，不需要配置个人 Token。
    try {
        const response = await fetch(new URL('/comments.json', config.url), { signal: AbortSignal.timeout(10000) });
        const published = await response.json();
        assert.ok(response.ok && published.repository === output.repository && published.available);
        writeFileSync('public/comments.json', JSON.stringify(published));
        console.log('Using published comment index for local preview.');
        process.exit(0);
    } catch {
        output.available = false;
    }
} else {
    const query = 'query($owner: String!, $name: String!, $category: ID!, $cursor: String) { repository(owner: $owner, name: $name) { discussions(first: 100, categoryId: $category, after: $cursor) { pageInfo { hasNextPage endCursor } nodes { id title url } } } }';
    let cursor = null;
    do {
        const data = await graphql(query, { owner, name, category, cursor });
        const page = data.repository.discussions;
        for (const discussion of page.nodes.filter(item => terms.has(item.title))) {
            const comments = await allNodes(discussion.id, 'comments');
            let totalReplyCount = 0;
            for (const comment of comments) {
                const replies = await allNodes(comment.id, 'replies', comment.replies);
                totalReplyCount += replies.length;
                comment.replyCount = replies.length;
                comment.replies = replies;
            }
            output.discussions[discussion.title] = { url: discussion.url, totalCommentCount: comments.length, totalReplyCount, comments };
        }
        cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
        if (page.pageInfo.hasNextPage) assert.ok(cursor, 'Missing discussion cursor');
    } while (cursor);
}
writeFileSync('public/comments.json', JSON.stringify(output));
console.log('Exported ' + Object.keys(output.discussions).length + ' public article discussion(s).');
