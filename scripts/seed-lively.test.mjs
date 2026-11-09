import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ACTIVITY, id, normalize, protectedLogin, suspiciousUser, writableTarget, migrate, populate, verify, prepareLocalDirectory } from './seed-lively.mjs';

test('production guards and protected demo identities', () => {
  for (const url of ['postgres://u:p@ep-demo.neon.tech/db', 'postgres://u:p@db.example.com/db',
    'postgres://u:p@localhost/db?host=ep-prod.neon.tech'])
    assert.throws(() => writableTarget(url), /blocked/);
  assert.throws(() => writableTarget('', ''), /dedicated/);
  assert.throws(() => writableTarget('', 'memory'), /dedicated/);
  assert.doesNotThrow(() => writableTarget('', '.cache/lively-test'));
  assert.equal(normalize('Đặng Thị Bảo Ngọc'), 'dang thi bao ngoc');
  assert.equal(id('member:1'), id('member:1'));
  for (const u of [{ full_name: 'Coach Test 12345', email: 'coach@arena3.local' },
    { full_name: 'Coach Check 5319583', phone: '+84900000002' }]) {
    assert.ok(protectedLogin(u)); assert.equal(suspiciousUser(u), false);
  }
  assert.ok(suspiciousUser({ full_name: 'Coach Swim 9048569' }));
  assert.equal(suspiciousUser({ full_name: 'Nguyễn Minh Khoa' }), false);
});

test('PGlite directory survives close and reopen on Windows', async () => {
  await mkdir('.cache', { recursive: true });
  const dir = await mkdtemp(resolve('.cache', 'lively-persistence-'));
  await prepareLocalDirectory(dir);
  const first = new PGlite({ dataDir: dir });
  await first.exec('create table persistence_probe(value int); insert into persistence_probe values(42)');
  await first.close();
  await prepareLocalDirectory(dir);
  const second = new PGlite({ dataDir: dir });
  try { assert.equal((await second.query('select value from persistence_probe')).rows[0].value, 42); }
  finally { await second.close(); }
});

test('real migrations, financial/schedule invariants, rerun idempotency and rollback', { timeout: 180000 }, async () => {
  const db = new PGlite({ parsers: { 1082: s => s, 20: Number } });
  try {
    await migrate(db);
    const logins = (await db.query('select id, phone, email, password_hash, google_sub from users order by id')).rows;
    const asOf = '2026-11-09T16:00:00.000Z';
    const snapshot = async () => {
      await db.exec(`truncate table ${ACTIVITY.join(',')} restart identity`);
      const report = await populate(db, asOf);
      assert.ok(report.added.court_bookings > 5000);
      assert.equal(report.added.users, report.added.users ? 96 : 0);
      assert.deepEqual((await verify(db, asOf)).failures, {});
      const result = {};
      for (const t of ACTIVITY) result[t] = (await db.query(`select md5(coalesce(string_agg(row_to_json(r)::text, '|' order by row_to_json(r)::text),'')) hash from ${t} r`)).rows[0].hash;
      return result;
    };
    const first = await snapshot();
    assert.deepEqual(await snapshot(), first, 'same as-of must produce exactly the same activity rows');
    assert.equal(Number((await db.query('select count(*) n from users')).rows[0].n), logins.length + 96);
    for (const u of logins) assert.deepEqual((await db.query('select id, phone, email, password_hash, google_sub from users where id=$1', [u.id])).rows[0], u);
    // The DB's overlap protection stays enabled.
    const occ = (await db.query('select * from occupancies limit 1')).rows[0];
    await assert.rejects(db.query('insert into occupancies(court_id,start_at,end_at,kind,ref_id) values($1,$2,$3,$4,$5)',
      [occ.court_id, occ.start_at, occ.end_at, 'booking', id('deliberate-conflict')]), /CONFLICT_SLOT/);
    await db.exec('begin');
    await db.exec(`truncate table ${ACTIVITY.join(',')} restart identity`);
    await assert.rejects(populate(db, 'invalid'), /Invalid/);
    await db.exec('rollback');
    assert.deepEqual((await verify(db, asOf)).failures, {});
  } finally { await db.close(); }
});
