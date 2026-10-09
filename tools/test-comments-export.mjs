import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = readFileSync('tools/export-comments.mjs', 'utf8')
    .replace(/^import[^\n]+\n/gm, '')
    .replace('const require = createRequire(import.meta.url);', '');
const term = 'post/' + encodeURIComponent('测试');
const calls = [];
let exported;
const reply = index => ({ id: 'reply-' + index, bodyText: 'Reply ' + index, author: { login: 'reader' }, createdAt: '2026-10-09T00:00:00Z' });
const page = (nodes, totalCount, hasNextPage = false, endCursor = null) => ({ nodes, totalCount, pageInfo: { hasNextPage, endCursor } });
const context = {
    assert, path, require, URL, Set, Date, JSON, AbortSignal,
    process: { env: { GH_TOKEN: 'test-only-placeholder' } },
    console: { log() {} },
    readFileSync(file) {
        if (file === '_config.yml') return 'url: https://zhang-qp03.github.io';
        if (file === '_config.stellar.yml') return 'comments:\n  giscus:\n    data-repo: zhang-qp03/zhang-qp03.github.io\n    data-category: Announcements\n    data-category-id: DIC_kwDOVCIOXM4DHaAL';
        return '<div id="giscus"></div>';
    },
    readdirSync(directory) {
        const folder = directory === 'public';
        return [{ name: folder ? 'post' : '测试.html', isDirectory: () => folder }];
    },
    writeFileSync(_file, data) { exported = JSON.parse(data); },
    async fetch(_url, options) {
        const { query, variables } = JSON.parse(options.body);
        calls.push(variables);
        let data;
        if (query.includes('repository(owner:')) {
            data = { repository: { discussions: {
                nodes: [{ id: 'article', title: term, url: 'https://github.com/zhang-qp03/zhang-qp03.github.io/discussions/1' }, { id: 'unrelated', title: 'Other announcement' }],
                pageInfo: { hasNextPage: false }
            } } };
        } else if (variables.id === 'article' && !variables.cursor) {
            data = { node: { comments: page([{
                id: 'comment-1', bodyText: 'First comment',
                replies: page(Array.from({ length: 100 }, (_, index) => reply(index)), 101, true, 'reply-page-2')
            }], 2, true, 'comment-page-2') } };
        } else if (variables.id === 'article' && variables.cursor === 'comment-page-2') {
            data = { node: { comments: page([{ id: 'comment-2', bodyText: 'Second comment', replies: page([], 0) }], 2) } };
        } else if (variables.id === 'comment-1' && variables.cursor === 'reply-page-2') {
            data = { node: { replies: page([reply(100)], 101) } };
        } else throw new Error('Unexpected query ' + JSON.stringify(variables));
        return { ok: true, json: async () => ({ data }) };
    }
};
await new vm.Script('(async () => {\n' + source + '\n})()').runInNewContext(context);
assert.equal(exported.available, true);
assert.deepEqual(Object.keys(exported.discussions), [term]);
assert.equal(exported.discussions[term].totalCommentCount, 2);
assert.equal(exported.discussions[term].totalReplyCount, 101);
assert.equal(exported.discussions[term].comments[0].replies.length, 101);
assert.ok(calls.some(call => call.cursor === 'comment-page-2'));
assert.ok(calls.some(call => call.cursor === 'reply-page-2'));
assert.ok(!calls.some(call => call.id === 'unrelated'));
console.log('Verified complete comment/reply pagination and exclusion of unrelated Discussions.');
