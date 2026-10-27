// Copy this file and monthly-compaction.yml to the PRIVATE data repository.
// This is the only administrative operation allowed to replace history.
const repo = process.env.GITHUB_REPOSITORY || process.env.SYNC_DATA_REPO;
const token = process.env.GITHUB_TOKEN, branch = process.env.SYNC_DATA_BRANCH || 'main';
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !token || !/^[\w.-]+$/.test(branch)) throw new Error('Missing repository/token/branch');
const base = 'https://api.github.com/repos/' + repo;
async function api(path, method = 'GET', data) {
  const r = await fetch(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: {
    Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'WISS-Sync-Maintenance', ...(data ? { 'Content-Type': 'application/json' } : {})
  }, ...(data ? { body: JSON.stringify(data) } : {}) });
  if (!r.ok) throw new Error('GitHub maintenance request failed: ' + r.status);
  return r.json();
}
const refPath = '/git/refs/heads/' + branch;
if (!(await api('')).private) throw new Error('Refusing history maintenance on a public repository');
const original = (await api('/git/ref/heads/' + branch)).object.sha;
const old = await api('/git/commits/' + original);
const tree = await api('/git/trees/' + old.tree.sha);
if (tree.tree.some((e) => e.path === '.sync-maintenance')) throw new Error('Maintenance already active; inspect the previous run');
// Publish a lock with a normal commit. Server transactions refuse this tree. Any transaction
// already in flight has an older parent and cannot fast-forward over the lock commit.
const marker = await api('/git/blobs', 'POST', { content: JSON.stringify({ at: new Date().toISOString() }), encoding: 'utf-8' });
const lockedTree = await api('/git/trees', 'POST', { base_tree: old.tree.sha, tree: [{ path: '.sync-maintenance', mode: '100644', type: 'blob', sha: marker.sha }] });
const lock = await api('/git/commits', 'POST', { message: 'Lock encrypted sync history maintenance', tree: lockedTree.sha, parents: [original] });
await api(refPath, 'PATCH', { sha: lock.sha, force: false });
// Keep exactly the original current tree (accounts + this workflow), without the lock.
const fresh = await api('/git/commits', 'POST', { message: 'Monthly encrypted sync snapshot', tree: old.tree.sha, parents: [] });
if ((await api('/git/ref/heads/' + branch)).object.sha !== lock.sha) throw new Error('Head changed during maintenance; refusing history replacement');
await api(refPath, 'PATCH', { sha: fresh.sha, force: true });
console.log('History compacted. This does not guarantee deletion of GitHub retained objects or backups.');
