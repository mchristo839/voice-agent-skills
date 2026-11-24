#!/usr/bin/env node
// Check the Cal.com side before the agent goes live. Read only: it never books anything.
// List event types:   node cal-check.mjs --list
// Check open slots:   node cal-check.mjs --event-type 123456 [--days 7] [--tz America/Chicago]
import { cal, VERSIONS, CAL_BASE } from './_cal.mjs';
import { arg } from './_retell.mjs';

const tz = arg('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);

function eventTypesFrom(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  // Older shapes grouped event types by user or team.
  if (d?.eventTypeGroups) return d.eventTypeGroups.flatMap(g => g.eventTypes || []);
  return [];
}

function slotsFrom(res) {
  const d = res?.data?.slots || res?.data || {};
  const out = [];
  for (const [day, list] of Object.entries(d)) {
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      const start = typeof s === 'string' ? s : s?.start || s?.time;
      if (start) out.push({ day, start });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function local(iso) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(iso));
}

if (arg('list', false) === true) {
  const types = eventTypesFrom(await cal('/v2/event-types', { version: VERSIONS.eventTypes }));
  if (!types.length) {
    console.log('No event types found. Create one in Cal.com (it calls them "links") and run this again.');
    process.exit(1);
  }
  console.log(`Event types on ${CAL_BASE}:\n`);
  for (const t of types) {
    const mins = t.lengthInMinutes ?? t.length ?? '?';
    console.log(`  ${String(t.id).padEnd(10)} ${t.title} (${mins} min)${t.hidden ? ' [hidden]' : ''}`);
  }
  console.log('\nNext: node cal-check.mjs --event-type <id> to see what a caller would be offered.');
  process.exit(0);
}

const eventType = arg('event-type');
if (!eventType || eventType === true) {
  console.error('Usage: node cal-check.mjs --list\n       node cal-check.mjs --event-type <id> [--days 7] [--tz Area/City]');
  process.exit(1);
}

const days = Number(arg('days', 7));
const start = new Date();
const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
const res = await cal('/v2/slots', {
  version: VERSIONS.slots,
  query: { eventTypeId: eventType, start: start.toISOString(), end: end.toISOString(), timeZone: tz }
});
const slots = slotsFrom(res);

console.log(`Event type ${eventType}, next ${days} days, shown in ${tz}\n`);
if (!slots.length) {
  console.log('No open slots. The agent would tell every caller there is nothing free.');
  console.log('Check: the event type has working hours, its calendar is connected under Apps, and the minimum notice is not longer than the window.');
  process.exit(2);
}

const byDay = {};
for (const s of slots) (byDay[s.day] ||= []).push(s.start);
for (const [day, list] of Object.entries(byDay)) {
  const shown = list.slice(0, 6).map(local).map(t => t.split(', ').pop());
  console.log(`  ${local(list[0]).split(',').slice(0, 2).join(',')}: ${shown.join(', ')}${list.length > 6 ? ` and ${list.length - 6} more` : ''}`);
}
console.log(`\n${slots.length} open slots. This is what Retell's Check Availability tool will see.`);
