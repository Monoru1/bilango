import { createHmac } from 'node:crypto';
import type { AudienceEvent } from '@gobilan/contracts';
import { DAY_MS, toDayKey, type AudienceCounts, type AudienceReport } from '@gobilan/domain';
import type { Deps } from '../deps';

const totals = `
  count(distinct visitor_key) filter (where kind = 'visit')::int as visitors,
  count(distinct visit_key) filter (where kind = 'visit')::int as visits,
  count(*) filter (where kind = 'install_click')::int as "installClicks",
  count(*) filter (where kind = 'android_install')::int as "androidInstalls",
  count(*) filter (where kind = 'first_open')::int as "firstOpens",
  count(*) filter (where kind = 'registration')::int as registrations`;

export class AudienceService {
  constructor(private deps: Deps) {}

  private digest(value: string) {
    return createHmac('sha256', this.deps.config.audience!.key).update(value).digest('hex');
  }

  async record(event: AudienceEvent) {
    if (event.kind === 'android_install' && event.platform !== 'android') return;
    const db = this.deps.db;
    const day = toDayKey(this.deps.clock.now(), 0);
    const visitor = this.digest('visitor:' + event.visitor);
    const visit = event.kind === 'visit' ? this.digest('visit:' + event.visitor + ':' + event.session) : null;
    let source: AudienceReport['sources'][number]['source'] = event.kind === 'visit' ? event.source : 'direct';
    if (event.kind === 'visit' && event.referral) {
      const { rows } = await db.query<{ role: 'agent' | 'influencer' }>(
        "select role from partners where promo_code = $1 and status = 'active' and role in ('agent', 'influencer')", [event.referral]);
      source = rows[0]?.role ?? source;
    }
    await db.query(`
      insert into audience_events(event_key, visitor_key, visit_key, kind, platform, source, day)
      values ($1,$2,$3,$4,$5,$6,$7)
      on conflict do nothing`, [this.digest('event:' + event.visitor + ':' + event.id), visitor, visit, event.kind, event.platform, source, day]);
  }

  async forget(visitor: string) {
    await this.deps.db.query('delete from audience_events where visitor_key=$1', [this.digest('visitor:' + visitor)]);
  }

  async start() {
    const day = toDayKey(this.deps.clock.now(), 0);
    await this.deps.db.query('insert into audience_collection values (true, $1) on conflict do nothing', [day]);
    await this.prune();
  }

  async prune() {
    const cutoff = toDayKey(this.deps.clock.now() - 89 * DAY_MS, 0);
    await this.deps.db.query('delete from audience_events where day < $1', [cutoff]);
  }

  async report(from: string, to: string): Promise<AudienceReport | null> {
    if (!this.deps.config.audience) return null;
    const db = this.deps.db;
    const cutoff = toDayKey(this.deps.clock.now() - 89 * DAY_MS, 0);
    const { rows: coverage } = await db.query<{ started: string }>('select started_on::text as started from audience_collection');
    if (!coverage[0]) return null;
    const collectionStartedOn = coverage[0].started > cutoff ? coverage[0].started : cutoff;
    const start = from > collectionStartedOn ? from : collectionStartedOn;
    const dates = [start, to < toDayKey(this.deps.clock.now(), 0) ? to : toDayKey(this.deps.clock.now(), 0)];
    const aggregate = `from audience_events where day between $1 and $2`;
    const [total, days, sources, platforms] = await Promise.all([
      db.query<AudienceCounts>(`select ${totals} ${aggregate}`, dates),
      db.query<AudienceCounts & { day: string }>(`select day::text, ${totals} ${aggregate} group by day order by day`, dates),
      db.query<AudienceCounts & { source: AudienceReport['sources'][number]['source'] }>(`select source, ${totals} ${aggregate} and kind='visit' group by source order by source`, dates),
      db.query<AudienceCounts & { platform: AudienceReport['platforms'][number]['platform'] }>(`select platform, ${totals} ${aggregate} group by platform order by platform`, dates),
    ]);
    return {
      collectionStartedOn,
      total: total.rows[0]!,
      days: days.rows.map(({ day, ...counts }) => ({ day, counts })),
      sources: sources.rows.map(({ source, ...counts }) => ({ source, counts })),
      platforms: platforms.rows.map(({ platform, ...counts }) => ({ platform, counts })),
    };
  }
}
