#!/usr/bin/env node
/**
 * timetable — Interactive CLI Timetable Manager
 *
 * Usage:
 *   timetable                        # interactive TUI (default)
 *   timetable add "title" [-s HH:MM] [-e HH:MM] [-d YYYY-MM-DD]
 *   timetable list [-d YYYY-MM-DD]
 *   timetable done      <id> [-d YYYY-MM-DD]
 *   timetable skip      <id> [-d YYYY-MM-DD]
 *   timetable cancel    <id> [-d YYYY-MM-DD]
 *   timetable pending   <id> [-d YYYY-MM-DD]
 *   timetable time      <id> [-s HH:MM] [-e HH:MM] [-d YYYY-MM-DD]
 *   timetable remove    <id> [-d YYYY-MM-DD]
 *   timetable reset     [-d YYYY-MM-DD]
 */

const { program } = require('commander');
const chalk       = require('chalk');
const dayjs       = require('dayjs');

const { getEntries, addEntry, removeEntry, updateEntry, resetEntries } = require('./src/storage');
const { renderTable, success, error, info } = require('./src/display');
const { startInteractive } = require('./src/interactive');

// ─── utility ────────────────────────────────────────────────────────────────

function todayKey()              { return dayjs().format('YYYY-MM-DD'); }
function dateKey(opt)            { return opt ? dayjs(opt).format('YYYY-MM-DD') : todayKey(); }
function requireEntry(id, date)  {
  const entries = getEntries(date);
  const e = entries.find(x => x.id === Number(id));
  if (!e) { error(`No entry with id ${id} on ${date}.`); process.exit(1); }
  return e;
}

// ─── program ────────────────────────────────────────────────────────────────

program
  .name('timetable')
  .description(chalk.bold.cyan('Interactive CLI Timetable Manager'))
  .version('1.0.0', '-v, --version');

// ── interactive (default when no args) ──────────────────────────────────────
program
  .command('interactive', { isDefault: true, hidden: true })
  .description('Launch the interactive TUI (default)')
  .option('-d, --date <YYYY-MM-DD>', 'Start on a specific date')
  .action(opts => startInteractive(opts.date ? dateKey(opts.date) : undefined));

// ── list ─────────────────────────────────────────────────────────────────────
program
  .command('list')
  .alias('ls')
  .description('List entries for a day')
  .option('-d, --date <YYYY-MM-DD>', 'Target date (default: today)')
  .action(opts => {
    const dk      = dateKey(opts.date);
    const entries = getEntries(dk);
    renderTable(entries, dk);
  });

// ── add ──────────────────────────────────────────────────────────────────────
program
  .command('add <title>')
  .description('Add a new entry')
  .option('-s, --start <HH:MM>',      'Start time')
  .option('-e, --end   <HH:MM>',      'End time')
  .option('-d, --date  <YYYY-MM-DD>', 'Target date (default: today)')
  .action((title, opts) => {
    const dk    = dateKey(opts.date);
    const entry = addEntry(dk, title, opts.start || '', opts.end || '');
    success(`Added "${entry.title}" (#${entry.id}) on ${dk}`);
  });

// ── status commands ──────────────────────────────────────────────────────────
for (const [cmd, status, desc] of [
  ['done',    'done',      'Mark an entry as done'],
  ['skip',    'skipped',   'Mark an entry as skipped'],
  ['cancel',  'cancelled', 'Mark an entry as cancelled'],
  ['pending', 'pending',   'Reset an entry to pending'],
]) {
  program
    .command(`${cmd} <id>`)
    .description(desc)
    .option('-d, --date <YYYY-MM-DD>', 'Target date (default: today)')
    .action((id, opts) => {
      const dk    = dateKey(opts.date);
      requireEntry(id, dk);
      const entry = updateEntry(dk, id, { status });
      success(`"${entry.title}" marked as ${status}.`);
    });
}

// ── time ─────────────────────────────────────────────────────────────────────
program
  .command('time <id>')
  .description('Set start/end time for an entry')
  .option('-s, --start <HH:MM>',      'Start time')
  .option('-e, --end   <HH:MM>',      'End time')
  .option('-d, --date  <YYYY-MM-DD>', 'Target date (default: today)')
  .action((id, opts) => {
    const dk = dateKey(opts.date);
    requireEntry(id, dk);
    const updates = {};
    if (opts.start) updates.startTime = opts.start;
    if (opts.end)   updates.endTime   = opts.end;
    if (!opts.start && !opts.end) {
      error('Provide at least --start or --end.');
      process.exit(1);
    }
    const entry = updateEntry(dk, id, updates);
    success(`Time updated for "${entry.title}": ${entry.startTime || '─'} → ${entry.endTime || '─'}`);
  });

// ── remove ───────────────────────────────────────────────────────────────────
program
  .command('remove <id>')
  .alias('rm')
  .description('Remove an entry')
  .option('-d, --date <YYYY-MM-DD>', 'Target date (default: today)')
  .action((id, opts) => {
    const dk    = dateKey(opts.date);
    const entry = requireEntry(id, dk);
    removeEntry(dk, id);
    success(`Removed "${entry.title}" (#${id}).`);
  });

// ── reset ────────────────────────────────────────────────────────────────────
program
  .command('reset')
  .description('Reset all entries to pending')
  .option('-d, --date <YYYY-MM-DD>', 'Target date (default: today)')
  .action(opts => {
    const dk = dateKey(opts.date);
    resetEntries(dk);
    success(`All entries on ${dk} reset to pending.`);
  });

// ─── entry point ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const HELP_FLAGS    = new Set(['--help', '-h']);
const VERSION_FLAGS = new Set(['--version', '-v', '-V']);

// Known subcommand names
const SUBCOMMANDS = new Set(['list', 'ls', 'add', 'done', 'skip', 'cancel', 'pending', 'time', 'remove', 'rm', 'reset', 'interactive', 'i']);

const firstArg  = args[0];
const hasSubcmd = firstArg && SUBCOMMANDS.has(firstArg);
const isFlag    = firstArg && firstArg.startsWith('-');

if (!args.length) {
  // No args at all → interactive TUI
  startInteractive();
} else if (isFlag && !HELP_FLAGS.has(firstArg) && !VERSION_FLAGS.has(firstArg)) {
  // e.g. timetable -d 2026-04-01 → interactive with date
  program.parse(process.argv);
} else if (hasSubcmd || HELP_FLAGS.has(firstArg) || VERSION_FLAGS.has(firstArg)) {
  program.parse(process.argv);
} else {
  // Unknown subcommand / anything else → interactive
  startInteractive();
}
