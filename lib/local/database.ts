/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { localUserId } from './config';
const root = path.resolve(
  /* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || path.join(process.cwd(), '.local-data'),
);
const state = globalThis as typeof globalThis & { mailLocalDB?: Promise<PGlite> };
export function database() {
  return (state.mailLocalDB ||= (async () => {
    await mkdir(root, { recursive: true });
    const db = new PGlite(path.join(root, 'postgres'));
    await db.waitReady;
    const exists = await db.query("select to_regclass('public.local_migrations') as name");
    if (!(exists.rows[0] as any).name) {
      await db.transaction(async (tx) => {
        await tx.exec(`create role anon; create role authenticated; create role service_role bypassrls;
          create schema auth; create table auth.users(id uuid primary key);
          create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
          create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
          create table local_migrations(name text primary key);
          create table local_profile(id uuid primary key, metadata jsonb not null default '{}');`);
        await tx.exec(
          (await readFile('supabase/schema.sql', 'utf8')).replace(
            'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
            '',
          ),
        );
        await tx.query('insert into auth.users values($1)', [localUserId]);
      });
    }
    for (const file of (await readdir('supabase/migrations')).sort()) {
      if ((await db.query('select 1 from local_migrations where name=$1', [file])).rows.length)
        continue;
      await db.transaction(async (tx) => {
        await tx.exec(await readFile(path.join('supabase/migrations', file), 'utf8'));
        await tx.query('insert into local_migrations values($1)', [file]);
      });
    }
    return db;
  })());
}
const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('Invalid database identifier');
  return `"${s}"`;
};
const value = (key: string, v: any) =>
  [
    'attachments',
    'email_columns',
    'source',
    'trigger_config',
    'config',
    'payload',
    'metadata',
  ].includes(key) && v !== null
    ? JSON.stringify(v)
    : v;
// Relations used by the application API, with explicit foreign-key direction.
const relations: Record<string, Record<string, [string, string, boolean]>> = {
  contacts: {
    imports: ['source_import_id', 'id', false],
    contact_group_members: ['id', 'contact_id', true],
    import_contacts: ['id', 'contact_id', true],
  },
  contact_group_members: { contact_groups: ['group_id', 'id', false] },
  import_contacts: {
    imports: ['source_import_id', 'id', false],
    contacts: ['contact_id', 'id', false],
  },
  email_queue: { campaigns: ['campaign_id', 'id', false] },
  automation_enrollments: {
    contacts: ['contact_id', 'id', false],
    automations: ['automation_id', 'id', false],
  },
  automations: {
    automation_steps: ['id', 'automation_id', true],
    automation_enrollments: ['id', 'automation_id', true],
  },
};
function splitColumns(s: string) {
  const out: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (s[i] === ',' && !depth) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(s.slice(start).trim());
  return out;
}
function projection(table: string, alias: string, columns: string): string {
  return splitColumns(columns)
    .map((c) => {
      if (c === '*') return `${alias}.*`;
      const rel = /^(\w+)(?:!inner)?\((.*)\)$/.exec(c);
      if (!rel) return `${alias}.${ident(c)}`;
      const [, target, fields] = rel,
        spec = relations[table]?.[target];
      if (!spec) throw new Error(`Unsupported relation ${table}.${target}`);
      const [left, right, many] = spec,
        child = `${alias}_${target}`;
      const where = `${child}.${ident(right)}=${alias}.${ident(left)}`;
      if (fields === 'count')
        return `(select json_build_array(json_build_object('count',count(*))) from ${ident(target)} ${child} where ${where}) as ${ident(target)}`;
      const sql = `select ${projection(target, child, fields)} from ${ident(target)} ${child} where ${where}`;
      return many
        ? `(select coalesce(json_agg(r),'[]'::json) from (${sql}) r) as ${ident(target)}`
        : `(select row_to_json(r) from (${sql}) r) as ${ident(target)}`;
    })
    .join(',');
}
class Query {
  private columns = '*';
  private operation = 'select';
  private rows: any[] = [];
  private filters: [string, string, any][] = [];
  private sorts: string[] = [];
  private take?: number;
  private skip = 0;
  private one = '';
  private options: any = {};
  private conflict: any = {};
  private returning = false;
  constructor(private table: string) {
    ident(table);
  }
  select(columns = '*', options: any = {}) {
    this.columns = columns;
    this.options = options;
    this.returning = true;
    return this;
  }
  insert(data: any) {
    this.operation = 'insert';
    this.rows = Array.isArray(data) ? data : [data];
    return this;
  }
  upsert(data: any, options: any = {}) {
    this.insert(data);
    this.operation = 'upsert';
    this.conflict = options;
    return this;
  }
  update(data: any) {
    this.operation = 'update';
    this.rows = [data];
    return this;
  }
  delete() {
    this.operation = 'delete';
    return this;
  }
  eq(k: string, v: any) {
    this.filters.push([k, '=', v]);
    return this;
  }
  lte(k: string, v: any) {
    this.filters.push([k, '<=', v]);
    return this;
  }
  ilike(k: string, v: any) {
    this.filters.push([k, 'ilike', v]);
    return this;
  }
  in(k: string, v: any[]) {
    this.filters.push([k, 'in', v]);
    return this;
  }
  order(k: string, o: any = {}) {
    this.sorts.push(`t.${ident(k)} ${o.ascending === false ? 'desc' : 'asc'}`);
    return this;
  }
  limit(n: number) {
    this.take = n;
    return this;
  }
  range(a: number, b: number) {
    this.skip = a;
    this.take = b - a + 1;
    return this;
  }
  single() {
    this.one = 'single';
    return this;
  }
  maybeSingle() {
    this.one = 'maybe';
    return this;
  }
  then<TResult1 = any, TResult2 = never>(
    resolve?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(resolve, reject);
  }
  async run(): Promise<any> {
    try {
      const db = await database(),
        args: any[] = [];
      const bind = (v: any) => {
        args.push(v);
        return `$${args.length}`;
      };
      const filters = this.filters.map(([key, op, v]) => {
        const [rel, col] = key.split('.');
        const compare = (column: string) =>
          op === 'in'
            ? v.length
              ? `${column} in (${v.map(bind).join(',')})`
              : 'false'
            : `${column} ${op} ${bind(v)}`;
        if (!col) return compare(`t.${ident(key)}`);
        const spec = relations[this.table]?.[rel];
        if (!spec) throw new Error('Unknown relation filter');
        return `exists(select 1 from ${ident(rel)} f where f.${ident(spec[1])}=t.${ident(spec[0])} and ${compare(`f.${ident(col)}`)})`;
      });
      const where = filters.length ? ' where ' + filters.join(' and ') : '';
      let sql = '',
        count: number | undefined;
      if (this.operation === 'select') {
        if (this.options.count)
          count = Number(
            (await db.query<any>(`select count(*) as n from ${ident(this.table)} t${where}`, args))
              .rows[0].n,
          );
        sql = `select ${projection(this.table, 't', this.columns)} from ${ident(this.table)} t${where}`;
        if (this.sorts.length) sql += ' order by ' + this.sorts.join(',');
        if (this.take !== undefined) sql += ` limit ${bind(this.take)}`;
        if (this.skip) sql += ` offset ${bind(this.skip)}`;
      } else if (this.operation === 'delete')
        sql = `delete from ${ident(this.table)} t${where} returning *`;
      else if (this.operation === 'update') {
        const set = Object.entries(this.rows[0])
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${ident(k)}=${bind(value(k, v))}`)
          .join(',');
        sql = `update ${ident(this.table)} t set ${set}${where} returning *`;
      } else {
        if (!this.rows.length) return { data: [], error: null };
        const keys = [
          ...new Set(this.rows.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined))),
        ];
        sql =
          `insert into ${ident(this.table)} (${keys.map(ident).join(',')}) values ` +
          this.rows
            .map(
              (r) =>
                '(' +
                keys.map((k) => (r[k] === undefined ? 'default' : bind(value(k, r[k])))).join(',') +
                ')',
            )
            .join(',');
        if (this.operation === 'upsert') {
          let conflict = this.conflict.onConflict;
          if (!conflict) {
            const pk = await db.query<any>(
              `select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=$1::regclass and i.indisprimary`,
              [this.table],
            );
            conflict = pk.rows.map((r) => r.attname).join(',');
          }
          const conflictKeys = conflict.split(',');
          const updates = keys
            .filter((k) => !conflictKeys.includes(k))
            .map((k) => `${ident(k)}=excluded.${ident(k)}`)
            .join(',');
          sql +=
            ` on conflict (${conflictKeys.map(ident).join(',')}) do ` +
            (this.conflict.ignoreDuplicates || !updates ? 'nothing' : 'update set ' + updates);
        }
        sql += ' returning *';
      }
      const result = await db.query(sql, args);
      if (this.one && (result.rows.length > 1 || (this.one === 'single' && !result.rows.length)))
        throw new Error('Expected one record.');
      return {
        data: this.options.head ? null : this.one ? result.rows[0] || null : result.rows,
        error: null,
        count,
      };
    } catch (e) {
      return {
        data: null,
        error: { message: e instanceof Error ? e.message : 'Local database error' },
      };
    }
  }
}
export const localDatabase = {
  from: (table: string) => new Query(table),
  async rpc(name: string, params: Record<string, any> = {}) {
    try {
      const db = await database(),
        args: any[] = [];
      const named = Object.entries(params).map(([k, v]) => {
        args.push(['p_summary', 'p_recipients', 'p_data'].includes(k) ? JSON.stringify(v) : v);
        return `${ident(k)} => $${args.length}`;
      });
      const setReturning = ['claim_email'].includes(name);
      const result = await db.query<any>(
        `select ${setReturning ? '* from ' : ''}${ident(name)}(${named.join(',')})${setReturning ? '' : ' as value'}`,
        args,
      );
      return { data: setReturning ? result.rows : result.rows[0]?.value, error: null };
    } catch (e) {
      return {
        data: null,
        error: { message: e instanceof Error ? e.message : 'Local database error' },
      };
    }
  },
  auth: {
    admin: {
      async updateUserById(id: string, data: any) {
        const db = await database();
        await db.query(
          'insert into local_profile values($1,$2) on conflict(id) do update set metadata=excluded.metadata',
          [id, JSON.stringify(data.user_metadata)],
        );
        return { error: null };
      },
    },
  },
  storage: {
    from: (bucket: string) => ({
      async upload(key: string, bytes: Uint8Array) {
        const file = storagePath(bucket, key);
        await mkdir(path.dirname(file), { recursive: true });
        const { writeFile } = await import('node:fs/promises');
        await writeFile(file, bytes, { flag: 'wx' });
        return { data: { path: key }, error: null };
      },
      async download(key: string) {
        try {
          return { data: new Blob([await readFile(storagePath(bucket, key))]), error: null };
        } catch {
          return { data: null, error: { message: 'Attachment not found' } };
        }
      },
    }),
  },
};
function storagePath(bucket: string, key: string) {
  if (bucket !== 'campaign-attachments' || !/^[-a-z0-9]+\/[-a-z0-9]+\.[a-z]+$/.test(key))
    throw new Error('Invalid attachment path');
  return path.join(root, 'attachments', key);
}
