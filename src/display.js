/**
 * display.js — All visual rendering helpers
 */

const chalk    = require('chalk');
const Table    = require('cli-table3');
const figlet   = require('figlet');
const boxen    = require('boxen');
const gradient = require('gradient-string');
const dayjs    = require('dayjs');

// ─── status config ───────────────────────────────────────────────────────────

const STATUS = {
  pending:   { icon: '○', label: 'Pending',   color: chalk.yellow,      bg: chalk.bgYellow.black  },
  done:      { icon: '✓', label: 'Done',       color: chalk.greenBright, bg: chalk.bgGreen.black   },
  skipped:   { icon: '→', label: 'Skipped',    color: chalk.cyan,        bg: chalk.bgCyan.black    },
  cancelled: { icon: '✗', label: 'Cancelled',  color: chalk.red,         bg: chalk.bgRed.white     },
};

function statusBadge(status) {
  const s = STATUS[status] || STATUS.pending;
  return s.color(`${s.icon} ${s.label}`);
}

function statusColor(status) {
  return (STATUS[status] || STATUS.pending).color;
}

// ─── progress bar ────────────────────────────────────────────────────────────

function progressBar(done, total, width = 20) {
  if (total === 0) return chalk.gray('─'.repeat(width));
  const filled = Math.round((done / total) * width);
  const empty  = width - filled;
  const pct    = Math.round((done / total) * 100);
  return chalk.greenBright('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + chalk.white(` ${pct}%`);
}

// ─── header ──────────────────────────────────────────────────────────────────

function renderHeader(date) {
  process.stdout.write('\x1Bc'); // clear screen

  const title     = figlet.textSync('TIMETABLE', { font: 'Small' });
  const gradTitle = gradient(['#f7971e', '#ffd200', '#21d4fd', '#b721ff'])(title);
  const dateStr   = dayjs(date).format('dddd, MMMM D, YYYY');
  const isToday   = dayjs(date).isSame(dayjs(), 'day');

  console.log(gradTitle);
  console.log(
    boxen(
      chalk.bold.white('📅  ') +
      chalk.bold.yellowBright(dateStr) +
      (isToday ? chalk.green('  ← today') : ''),
      {
        padding:     { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'magenta',
        dimBorder:   false,
      }
    )
  );
  console.log('');
}

// ─── table ───────────────────────────────────────────────────────────────────

function renderTable(entries, date) {
  renderHeader(date);

  if (entries.length === 0) {
    console.log(
      boxen(
        chalk.italic.gray('No objectives for this day yet.\n') +
        chalk.dim('Press ') + chalk.cyanBright('➕ Add') + chalk.dim(' to get started!'),
        { padding: 1, borderStyle: 'round', borderColor: 'gray', margin: { left: 2 } }
      )
    );
    console.log('');
    return;
  }

  const table = new Table({
    head: [
      chalk.bold.cyan('  #'),
      chalk.bold.cyan('Objective'),
      chalk.bold.cyan('Start'),
      chalk.bold.cyan('End'),
      chalk.bold.cyan('Status'),
    ],
    colWidths: [5, 34, 8, 8, 14],
    style:     { head: [], border: ['dim'] },
    chars: {
      'top':        '─', 'top-mid':    '┬', 'top-left':    '╭', 'top-right':    '╮',
      'bottom':     '─', 'bottom-mid': '┴', 'bottom-left': '╰', 'bottom-right': '╯',
      'left':       '│', 'left-mid':   '├', 'mid':         '─', 'mid-mid':      '┼',
      'right':      '│', 'right-mid':  '┤', 'middle':      '│',
    },
  });

  entries.forEach((entry, i) => {
    const color  = statusColor(entry.status);

    // Strikethrough for cancelled entries
    const title  = entry.status === 'cancelled'
      ? chalk.strikethrough.gray(entry.title)
      : color(entry.title);

    table.push([
      ` ${entry.id}`,
      title,
      chalk.cyan(entry.startTime || chalk.dim('─')),
      chalk.cyan(entry.endTime   || chalk.dim('─')),
      statusBadge(entry.status),
    ]);
  });

  console.log(table.toString());
  console.log('');

  // ── stats bar ───────────────────────────────────────────────────────────
  const total     = entries.length;
  const done      = entries.filter(e => e.status === 'done').length;
  const pending   = entries.filter(e => e.status === 'pending').length;
  const skipped   = entries.filter(e => e.status === 'skipped').length;
  const cancelled = entries.filter(e => e.status === 'cancelled').length;

  const stats = [
    chalk.greenBright(`✓ ${done} done`),
    chalk.yellow(`○ ${pending} pending`),
    chalk.cyan(`→ ${skipped} skipped`),
    chalk.red(`✗ ${cancelled} cancelled`),
  ].join(chalk.dim('  ·  '));

  const bar = progressBar(done, total, 24);

  console.log(
    boxen(
      `${bar}\n${stats}`,
      {
        padding:     { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'gray',
        margin:      { left: 0 },
      }
    )
  );
  console.log('');
}

// ─── single entry summary ────────────────────────────────────────────────────

function entryLine(entry) {
  const time = (entry.startTime || entry.endTime)
    ? chalk.dim(` [${entry.startTime || '?'}–${entry.endTime || '?'}]`)
    : '';
  return `${chalk.dim(`#${entry.id}`)} ${entry.title}${time}`;
}

// ─── success / error / info messages ─────────────────────────────────────────

function success(msg) { console.log(chalk.greenBright(`  ✓ ${msg}`)); }
function error(msg)   { console.log(chalk.red(`  ✗ ${msg}`)); }
function info(msg)    { console.log(chalk.dim(`  ℹ ${msg}`)); }

module.exports = { renderTable, renderHeader, statusBadge, entryLine, success, error, info };
