import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Slice 7: privacy and security audit of the whole database, read from the
// Postgres catalog. These tests cover every table, view and function — the
// ones that exist now and any added later — so a new migration that forgets
// RLS or exposes an author id fails here.

const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const rows = (q: string) =>
  execFileSync("psql", [DB_URL, "-tAF", "|", "-c", q], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("|"));

/** Columns that link content to an account, or secrets. */
const LINKING_COLUMN = /(^|_)(author|user|reporter|requester|admin)_id$|^email$|_email$|code_hash|publish_at|^is_admin$|^is_banned$/;

/** Tables anonymous visitors may read directly. Everything else goes through views. */
const ANON_READABLE_TABLES = ["companies"];

const COLS = `
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped`;

describe("tables", () => {
  const tables = rows(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
                       where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`);

  it("finds the tables (sanity check)", () => {
    expect(tables.map(([t]) => t)).toEqual(expect.arrayContaining(["profiles", "reviews", "posts", "verifications", "reports"]));
  });

  it("every table has Row Level Security switched on", () => {
    expect(tables.filter(([, rls]) => rls !== "t").map(([t]) => t)).toEqual([]);
  });

  it("anonymous visitors can read no base table except companies", () => {
    const readable = rows(`select distinct c.relname ${COLS}
                           where c.relkind = 'r' and has_column_privilege('anon', c.oid, a.attnum, 'select') order by 1`);
    expect(readable.map(([t]) => t)).toEqual(ANON_READABLE_TABLES);
  });

  it("anonymous visitors can write to no table", () => {
    const writable = rows(`select c.relname, p.priv from pg_class c
                             join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
                             cross join unnest(array['insert', 'update', 'delete', 'truncate']) p(priv)
                            where c.relkind = 'r' and has_table_privilege('anon', c.oid, p.priv)`);
    const colWritable = rows(`select distinct c.relname ${COLS}
                              where c.relkind = 'r' and (has_column_privilege('anon', c.oid, a.attnum, 'insert')
                                                      or has_column_privilege('anon', c.oid, a.attnum, 'update'))`);
    expect([...writable, ...colWritable]).toEqual([]);
  });

  it("signed-in users can never select a column that links content to an account", () => {
    const linking = rows(`select c.relname, a.attname ${COLS}
                          where c.relkind = 'r' and has_column_privilege('authenticated', c.oid, a.attnum, 'select')`)
      .filter(([, col]) => LINKING_COLUMN.test(col))
      .map(([t, col]) => `${t}.${col}`);
    // profiles.is_admin / is_banned: a user's OWN flags (RLS: own row only).
    expect(linking.filter((c) => !["profiles.is_admin", "profiles.is_banned"].includes(c))).toEqual([]);
  });

  it("no table grants signed-in users TRUNCATE, REFERENCES or TRIGGER", () => {
    const risky = rows(`select c.relname, p.priv from pg_class c
                          join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
                          cross join unnest(array['truncate', 'references', 'trigger']) p(priv)
                         where c.relkind = 'r' and has_table_privilege('authenticated', c.oid, p.priv)`);
    expect(risky).toEqual([]);
  });

  it("the tables holding secrets are closed to signed-in users entirely", () => {
    for (const table of ["verification_challenges", "rate_limit_events", "reports", "admin_actions"]) {
      const cols = rows(`select a.attname ${COLS} where c.relname = '${table}'
                         and has_column_privilege('authenticated', c.oid, a.attnum, 'select')`);
      expect(cols, table).toEqual([]);
    }
  });
});

describe("public views", () => {
  const views = rows(`select c.relname, coalesce(array_to_string(c.reloptions, ','), '') from pg_class c
                       join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relkind in ('v', 'm') and has_table_privilege('anon', c.oid, 'select')
                      order by 1`);

  it("finds the views (sanity check)", () => {
    expect(views.map(([v]) => v)).toEqual(expect.arrayContaining(["public_reviews", "public_posts", "public_profiles"]));
  });

  it("no public view has a column that links content to an account", () => {
    const linking = rows(`select c.relname, a.attname ${COLS}
                          where c.relkind in ('v', 'm') and has_table_privilege('anon', c.oid, 'select')`)
      .filter(([, col]) => LINKING_COLUMN.test(col))
      .map(([v, col]) => `${v}.${col}`);
    expect(linking).toEqual([]);
  });

  it("public_profiles shows only the pseudonym and checkmark — no id", () => {
    const cols = rows(`select a.attname ${COLS} where c.relname = 'public_profiles' order by a.attnum`).map(([c]) => c);
    expect(cols).toEqual(["pseudonym", "is_verified"]);
  });

  it("reviews, salaries and interviews show no pseudonym and no exact date", () => {
    for (const view of ["public_reviews", "public_interview_reports", "company_salary_stats"]) {
      const cols = rows(`select a.attname ${COLS} where c.relname = '${view}'`).map(([c]) => c);
      expect(cols.filter((c) => /pseudonym|created_at|updated_at|_at$/.test(c)), view).toEqual([]);
    }
  });

  it("every view that reads base tables is a security barrier", () => {
    expect(views.filter(([, opts]) => !opts.includes("security_barrier=true")).map(([v]) => v)).toEqual([]);
  });

  it("anonymous visitors cannot write through any view", () => {
    const writable = rows(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'public' and c.relkind = 'v'
                              and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update')
                                   or has_table_privilege('anon', c.oid, 'delete'))`);
    expect(writable).toEqual([]);
  });
});

describe("functions", () => {
  const fns = rows(`select p.proname, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), ''),
                           has_function_privilege('anon', p.oid, 'execute'),
                           has_function_privilege('authenticated', p.oid, 'execute')
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.prokind = 'f'
                       -- Trigger functions can't be called directly.
                       and p.prorettype <> 'trigger'::regtype`);

  it("every SECURITY DEFINER function pins its search_path", () => {
    const unsafe = fns.filter(([, def, config]) => def === "t" && !config.includes("search_path=")).map(([n]) => n);
    expect(unsafe).toEqual([]);
  });

  it("anonymous visitors can run no admin, maintenance or verification-granting function", () => {
    const open = fns
      .filter(([name, , , anon]) => anon === "t" && /^(admin_|run_maintenance|create_verification|confirm_company|revoke_|mark_expired|enforce_rate|set_user_company|has_active_verification|require_admin)/.test(name))
      .map(([n]) => n);
    expect(open).toEqual([]);
  });

  it("signed-in users can't run the server-only functions", () => {
    const open = fns
      .filter(([name, , , , auth]) => auth === "t" && /^(run_maintenance|create_verification_challenge|mark_expired_verifications|revoke_verification_internal|enforce_rate_limit|set_user_company_content_verified|has_active_verification)$/.test(name))
      .map(([n]) => n);
    expect(open).toEqual([]);
  });

  it("no function grants the checkmark except confirm_company_verification (rule 10)", () => {
    // Any function body that inserts a verification, or SETs a status to 'active'
    // (in a SET list, not a WHERE filter).
    const granting = rows(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public'
                              and (p.prosrc ~* 'insert\\s+into\\s+public\\.verifications'
                                   or p.prosrc ~* '(\\mset|,)\\s*status\\s*=\\s*''active''')`);
    expect(granting.map(([n]) => n)).toEqual(["confirm_company_verification"]);
  });
});
