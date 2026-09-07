import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { demoMe, demoProfiles, demoPosts, demoStorageKey, loadDemo, relativeTime } from '../src/lib/demo.js'
import * as api from '../src/lib/api.js'
import { supabase, isSupabaseConfigured } from '../src/lib/supabase.js'

// Offline unit/static checks only. No database, network, auth, or RLS execution.
const USER = '11111111-1111-4111-8111-111111111111'
const POST = '22222222-2222-4222-8222-222222222222'
const sql = await readFile(new URL('../supabase/migrations/202609070001_initial.sql', import.meta.url), 'utf8')
const tables = ['comments', 'follows', 'likes', 'posts', 'profiles', 'saves']
const photo = (type = 'image/png', size = 1) => new File([new Uint8Array(size)], 'photo.png', { type })
const profile = { full_name: 'Test User', username: 'test_user', bio: '' }

function withStorage(t, getItem) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem } })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  })
}

test('plain Node imports leave Supabase unconfigured without creating a client', () => {
  assert.equal(isSupabaseConfigured, false)
  assert.equal(supabase, null)
})

test('demo profile and post identifiers are unique', () => {
  const people = [demoMe, ...demoProfiles]
  assert.equal(new Set(people.map(p => p.id)).size, people.length)
  assert.equal(new Set(people.map(p => p.username)).size, people.length)
  assert.ok(demoPosts.length > 0)
  assert.equal(new Set(demoPosts.map(p => p.id)).size, demoPosts.length)
})

test('demo post and comment authors reference known profiles', () => {
  const people = new Map([demoMe, ...demoProfiles].map(p => [p.id, p]))
  const comments = new Set()
  for (const post of demoPosts) {
    assert.ok(post.profile)
    assert.deepEqual(post.profile, people.get(post.user_id))
    for (const comment of post.comments) {
      assert.ok(comment.profile)
      assert.deepEqual(comment.profile, people.get(comment.profile.id))
      assert.ok(!comments.has(comment.id))
      comments.add(comment.id)
      assert.ok(comment.body.trim())
    }
  }
})

test('demo posts have dates, HTTPS images, and initial relationship state', () => {
  for (const post of demoPosts) {
    assert.equal(new URL(post.image_url).protocol, 'https:')
    assert.ok(Number.isFinite(Date.parse(post.created_at)))
    assert.ok(Number.isInteger(post.likes_count) && post.likes_count >= 0)
    assert.equal(post.liked, false)
    assert.equal(post.saved, false)
  }
})

test('fresh demo follows reference existing profiles, not the current user', t => {
  withStorage(t, () => null)
  const data = loadDemo()
  assert.deepEqual(data.posts, demoPosts)
  assert.deepEqual(data.me, demoMe)
  assert.equal(new Set(data.following).size, data.following.length)
  for (const id of data.following) {
    assert.ok(demoProfiles.some(p => p.id === id))
    assert.notEqual(id, data.me.id)
  }
})

test('demo restores saved local workspace using its versioned key', t => {
  const saved = { posts: [], following: [], me: { ...demoMe, bio: 'Saved locally' } }
  withStorage(t, key => {
    assert.equal(key, demoStorageKey)
    return JSON.stringify(saved)
  })
  assert.deepEqual(loadDemo(), saved)
})

for (const [name, getItem] of [
  ['malformed JSON', () => '{broken'],
  ['wrong workspace shape', () => JSON.stringify({ posts: {}, following: [], me: demoMe })],
  ['wrong demo identity', () => JSON.stringify({ posts: [], following: [], me: { id: 'other' } })],
  ['unavailable storage', () => { throw new Error('Storage denied') }],
]) {
  test('demo falls back safely for ' + name, t => {
    withStorage(t, getItem)
    assert.deepEqual(loadDemo(), { posts: demoPosts, following: ['mila', 'james'], me: demoMe })
  })
}

test('relative time formats recent, hourly, daily, and future timestamps', t => {
  const now = Date.parse('2026-09-07T12:00:00Z')
  t.mock.method(Date, 'now', () => now)
  assert.equal(relativeTime(new Date(now - 10_000)), 'Just now')
  assert.equal(relativeTime(new Date(now - 2 * 3600_000)), '2h')
  assert.equal(relativeTime(new Date(now - 48 * 3600_000)), '2d')
  assert.equal(relativeTime(new Date(now + 3600_000)), 'Just now')
})

// Only checks that run BEFORE client/auth access are asserted here.
// Later paths such as target ownership require separate integration tests.
const invalidCases = [
  ['like state', () => api.toggleLike(POST, USER, 'false'), /Current relationship state must be true or false/],
  ['save state', () => api.toggleSave(POST, USER, null), /Current relationship state must be true or false/],
  ['follow state', () => api.toggleFollow(POST, USER, 1), /Current following state must be true or false/],
  ['like user ID', () => api.toggleLike(POST, 'invalid', false), /User ID is invalid/],
  ['save user ID', () => api.toggleSave(POST, null, false), /User ID is invalid/],
  ['follow user ID', () => api.toggleFollow(POST, 123, false), /User ID is invalid/],
  ['delete user ID', () => api.deletePost(POST, ''), /User ID is invalid/],
  ['comment user ID', () => api.addComment(POST, 'bad', 'hello'), /User ID is invalid/],
  ['empty comment', () => api.addComment(POST, USER, ' \n '), /Comment cannot be empty/],
  ['nontext comment', () => api.addComment(POST, USER, 12), /Comment must be text/],
  ['long comment', () => api.addComment(POST, USER, 'x'.repeat(1001)), /Comment must be 1000 characters or fewer/],
  ['long Unicode comment', () => api.addComment(POST, USER, '𝄞'.repeat(1001)), /Comment must be 1000 characters or fewer/],
  ['missing photo', () => api.createPost(USER, null), /Choose a photo to upload/],
  ['unsupported SVG', () => api.createPost(USER, photo('image/svg+xml')), /Choose a JPEG, PNG, WebP, or GIF/],
  ['empty photo', () => api.createPost(USER, photo('image/png', 0)), /larger than 0 bytes/],
  ['oversized photo', () => api.createPost(USER, photo('image/png', 5 * 1024 * 1024 + 1)), /no more than 5 MB/],
  ['long caption', () => api.createPost(USER, null, { caption: 'x'.repeat(2201) }), /Caption must be 2200 characters or fewer/],
  ['nontext caption', () => api.createPost(USER, null, { caption: [] }), /Caption must be text/],
  ['long location', () => api.createPost(USER, null, { location: 'x'.repeat(101) }), /Location must be 100 characters or fewer/],
  ['upload user ID', () => api.createPost('bad', photo()), /User ID is invalid/],
  ['long name', () => api.updateProfile(USER, { ...profile, full_name: 'x'.repeat(81) }), /Name must be 80 characters or fewer/],
  ['long biography', () => api.updateProfile(USER, { ...profile, bio: 'x'.repeat(151) }), /Bio must be 150 characters or fewer/],
  ['empty username', () => api.updateProfile(USER, { ...profile, username: ' ' }), /Username cannot be empty/],
  ['short username', () => api.updateProfile(USER, { ...profile, username: 'ab' }), /Username must be 3–40/],
  ['invalid username characters', () => api.updateProfile(USER, { ...profile, username: 'not.valid' }), /Username must be 3–40/],
  ['long username', () => api.updateProfile(USER, { ...profile, username: 'a'.repeat(41) }), /Username must be 40 characters or fewer/],
  ['profile user ID', () => api.updateProfile('bad', profile), /User ID is invalid/],
]
for (const [name, invoke, expected] of invalidCases) {
  test('rejects invalid ' + name + ' before Supabase access', async () => {
    assert.equal(supabase, null)
    await assert.rejects(invoke, expected)
  })
}

test('following with no user is empty without Supabase access', async () => {
  assert.deepEqual(await api.getFollowing(null), [])
})

test('valid Unicode comment boundary reaches missing-client guard', async () => {
  await assert.rejects(() => api.addComment(POST, USER, '𝄞'.repeat(1000)), /Configure VITE_SUPABASE_URL/)
})

test('SQL static: exactly one outer transaction, excluding PL/pgSQL body', () => {
  const outer = sql.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/--[^\n]*/g, '').trim()
  assert.equal([...outer.matchAll(/\bbegin\s*;/gi)].length, 1)
  assert.equal([...outer.matchAll(/\bcommit\s*;/gi)].length, 1)
  assert.match(outer, /^begin\s*;/i)
  assert.match(outer, /commit\s*;$/i)
  assert.equal([...sql.matchAll(/\$\$/g)].length, 2)
})

test('SQL static: exactly six expected table definitions, each once', () => {
  const defined = [...sql.matchAll(/create\s+table\s+public\.(\w+)\s*\(/gi)].map(m => m[1]).sort()
  assert.deepEqual(defined, tables)
  assert.equal([...sql.matchAll(/\bcreate\s+table\b/gi)].length, 6)
})

test('SQL static: all six tables enable RLS and define policies', () => {
  const enabled = [...sql.matchAll(/alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security\s*;/gi)].map(m => m[1]).sort()
  assert.deepEqual(enabled, tables)
  for (const table of tables) assert.match(sql, new RegExp('create policy \\w+ on public\\.' + table + '\\b', 'i'))
  assert.doesNotMatch(sql, /disable\s+row\s+level\s+security/i)
})

test('SQL static: corrected literals, metadata key, and username patterns', () => {
  assert.ok(sql.includes("username ~ '^[a-z0-9_]{3,40}$'"))
  assert.ok(sql.includes("username !~ '^user_[0-9a-f]{32}$'"))
  assert.ok(sql.includes("username = 'user_' || replace(id::text, '-', '')"))
  assert.ok(sql.includes("'user_' || replace(new.id::text, '-', '')"))
  assert.ok(sql.includes("left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80)"))
  assert.ok(sql.includes("set search_path = ''"))
  assert.doesNotMatch(sql, /[‘’“”]/)
  // Detect unbalanced SQL apostrophes, respecting doubled literal escapes.
  const withoutComments = sql.replace(/--[^\n]*/g, '')
  let quoted = false
  for (let i = 0; i < withoutComments.length; i++) {
    if (withoutComments[i] !== "'") continue
    if (quoted && withoutComments[i + 1] === "'") { i++; continue }
    quoted = !quoted
  }
  assert.equal(quoted, false)
})

test('SQL static: reserved regex matches only generated username namespace', () => {
  const pattern = sql.match(/username\s*!~\s*'([^']+)'/)?.[1]
  assert.equal(pattern, '^user_[0-9a-f]{32}$')
  const reserved = new RegExp(pattern)
  assert.ok(reserved.test('user_' + USER.replace(/-/g, '')))
  for (const name of ['user_alice', 'alice', 'user_' + 'a'.repeat(31), 'user_' + 'a'.repeat(33), 'user_' + 'g'.repeat(32)]) assert.equal(reserved.test(name), false)
})

test('SQL static: public bucket retains size, MIME, path, owner constraints', () => {
  assert.ok(sql.includes("values ('post-images', 'post-images', true, 5242880,"))
  assert.ok(sql.includes("array['image/jpeg', 'image/png', 'image/webp', 'image/gif']"))
  assert.ok(sql.includes("storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|gif)$'"))
  assert.ok(sql.includes('array_length(storage.foldername(name), 1) = 1'))
  assert.ok(sql.includes('owner_id = (select auth.uid())::text'))
})

test('SQL static: saves are owner-readable, not publicly readable', () => {
  assert.match(sql, /grant select on public\.saves to authenticated;/)
  assert.match(sql, /create policy saves_owner_read on public\.saves for select to authenticated using \(user_id = \(select auth\.uid\(\)\)\);/)
  assert.doesNotMatch(sql, /create policy \w+ on public\.saves[^;]*\b(?:anon|using\s*\(true\))/i)
})
