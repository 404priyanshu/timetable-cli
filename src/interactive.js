/**
 * interactive.js — Full TUI loop powered by inquirer
 */

const inquirer = require('inquirer');
const chalk    = require('chalk');
const dayjs    = require('dayjs');

const { getEntries, addEntry, removeEntry, updateEntry, resetEntries } = require('./storage');
const { renderTable, entryLine, success, error, info } = require('./display');

// ─── helpers ─────────────────────────────────────────────────────────────────

const TIME_RE = /^\d{1,2}:\d{2}$/;

function validateTime(v) {
  if (!v || v.trim() === '') return true;          // optional
  return TIME_RE.test(v.trim()) ? true : 'Use HH:MM format (e.g. 09:30)';
}

/** Build an inquirer choice list from entries */
function entryChoices(entries) {
  if (entries.length === 0) return [];
  return entries.map(e => ({
    name:  entryLine(e) + '  ' + statusTag(e.status),
    value: e.id,
  }));
}

const STATUS_TAG = {
  pending:   chalk.yellow('[pending]'),
  done:      chalk.green('[done]'),
  skipped:   chalk.cyan('[skipped]'),
  cancelled: chalk.red('[cancelled]'),
};
function statusTag(s) { return STATUS_TAG[s] || ''; }

/** Pause and wait for Enter */
async function pressEnter() {
  await inquirer.prompt([{ type: 'input', name: '_', message: chalk.dim('Press Enter to continue…') }]);
}

// ─── action handlers ──────────────────────────────────────────────────────────

async function handleAdd(dateKey) {
  console.log('');
  const answers = await inquirer.prompt([
    {
      type:     'input',
      name:     'title',
      message:  chalk.cyan('Objective title:'),
      validate: v => v.trim() ? true : 'Title cannot be empty',
    },
    {
      type:     'input',
      name:     'startTime',
      message:  chalk.cyan('Start time') + chalk.dim(' (HH:MM, optional):'),
      validate: validateTime,
    },
    {
      type:     'input',
      name:     'endTime',
      message:  chalk.cyan('End time') + chalk.dim('   (HH:MM, optional):'),
      validate: validateTime,
    },
  ]);

  const entry = addEntry(dateKey, answers.title, answers.startTime, answers.endTime);
  console.log('');
  success(`Added "${entry.title}" ${chalk.dim(`(#${entry.id})`)}`);
  await pressEnter();
}

async function handleSetStatus(dateKey, status, entries) {
  if (entries.length === 0) { error('No entries to update.'); await pressEnter(); return; }

  console.log('');
  const { id } = await inquirer.prompt([{
    type:    'list',
    name:    'id',
    message: chalk.cyan(`Mark as ${status}:`),
    choices: entryChoices(entries),
  }]);

  const entry = updateEntry(dateKey, id, { status });
  if (entry) success(`"${entry.title}" marked as ${status}.`);
  else       error('Entry not found.');
  await pressEnter();
}

async function handleSetTime(dateKey, entries) {
  if (entries.length === 0) { error('No entries to update.'); await pressEnter(); return; }

  console.log('');
  const { id } = await inquirer.prompt([{
    type:    'list',
    name:    'id',
    message: chalk.cyan('Set time for:'),
    choices: entryChoices(entries),
  }]);

  const current = entries.find(e => e.id === id);
  const answers = await inquirer.prompt([
    {
      type:     'input',
      name:     'startTime',
      message:  chalk.cyan('Start time') + chalk.dim(' (HH:MM):'),
      default:  current.startTime || '',
      validate: validateTime,
    },
    {
      type:     'input',
      name:     'endTime',
      message:  chalk.cyan('End time') + chalk.dim('   (HH:MM):'),
      default:  current.endTime || '',
      validate: validateTime,
    },
  ]);

  const entry = updateEntry(dateKey, id, {
    startTime: answers.startTime.trim(),
    endTime:   answers.endTime.trim(),
  });
  if (entry) success(`Time updated for "${entry.title}": ${entry.startTime || '─'} → ${entry.endTime || '─'}`);
  else       error('Entry not found.');
  await pressEnter();
}

async function handleEdit(dateKey, entries) {
  if (entries.length === 0) { error('No entries to edit.'); await pressEnter(); return; }

  console.log('');
  const { id } = await inquirer.prompt([{
    type:    'list',
    name:    'id',
    message: chalk.cyan('Edit entry:'),
    choices: entryChoices(entries),
  }]);

  const current = entries.find(e => e.id === id);
  const { title } = await inquirer.prompt([{
    type:     'input',
    name:     'title',
    message:  chalk.cyan('New title:'),
    default:  current.title,
    validate: v => v.trim() ? true : 'Title cannot be empty',
  }]);

  const entry = updateEntry(dateKey, id, { title: title.trim() });
  if (entry) success(`Renamed to "${entry.title}".`);
  else       error('Entry not found.');
  await pressEnter();
}

async function handleRemove(dateKey, entries) {
  if (entries.length === 0) { error('No entries to remove.'); await pressEnter(); return; }

  console.log('');
  const { id } = await inquirer.prompt([{
    type:    'list',
    name:    'id',
    message: chalk.red('Remove which entry?'),
    choices: entryChoices(entries),
  }]);

  const entry = entries.find(e => e.id === id);
  const { confirm } = await inquirer.prompt([{
    type:    'confirm',
    name:    'confirm',
    message: chalk.red(`Delete "${entry.title}"? This cannot be undone.`),
    default: false,
  }]);

  if (confirm) {
    removeEntry(dateKey, id);
    success(`Removed "${entry.title}".`);
  } else {
    info('Cancelled.');
  }
  await pressEnter();
}

async function handleReset(dateKey) {
  console.log('');
  const { confirm } = await inquirer.prompt([{
    type:    'confirm',
    name:    'confirm',
    message: chalk.yellow('Reset all entries to Pending?'),
    default: false,
  }]);

  if (confirm) {
    resetEntries(dateKey);
    success('All entries reset to Pending.');
  } else {
    info('Cancelled.');
  }
  await pressEnter();
}

async function handleSwitchDate() {
  console.log('');
  const { newDate } = await inquirer.prompt([{
    type:     'input',
    name:     'newDate',
    message:  chalk.cyan('Enter date') + chalk.dim(' (YYYY-MM-DD or +1, -1 for relative):'),
    default:  dayjs().format('YYYY-MM-DD'),
    validate: v => {
      const trimmed = v.trim();
      if (/^[+-]\d+$/.test(trimmed)) return true; // relative
      if (dayjs(trimmed).isValid()) return true;
      return 'Invalid date. Use YYYY-MM-DD or +1 / -1';
    },
  }]);

  const trimmed = newDate.trim();
  if (/^[+-]\d+$/.test(trimmed)) {
    const offset = parseInt(trimmed, 10);
    return dayjs().add(offset, 'day').format('YYYY-MM-DD');
  }
  return dayjs(trimmed).format('YYYY-MM-DD');
}

// ─── main TUI loop ────────────────────────────────────────────────────────────

async function startInteractive(initialDate) {
  let dateKey = initialDate || dayjs().format('YYYY-MM-DD');

  while (true) {
    const entries = getEntries(dateKey);
    renderTable(entries, dateKey);

    const hasEntries = entries.length > 0;

    const { action } = await inquirer.prompt([{
      type:     'list',
      name:     'action',
      message:  chalk.bold('What would you like to do?'),
      pageSize: 16,
      choices:  [
        {
          name:  chalk.greenBright('➕  Add new objective'),
          value: 'add',
        },
        new inquirer.Separator(chalk.dim('── mark status ─────────────────────')),
        {
          name:     chalk.greenBright('✓   Mark as Done'),
          value:    'done',
          disabled: !hasEntries,
        },
        {
          name:     chalk.cyan('→   Mark as Skipped'),
          value:    'skipped',
          disabled: !hasEntries,
        },
        {
          name:     chalk.red('✗   Mark as Cancelled'),
          value:    'cancelled',
          disabled: !hasEntries,
        },
        {
          name:     chalk.yellow('○   Mark as Pending (undo)'),
          value:    'pending',
          disabled: !hasEntries,
        },
        new inquirer.Separator(chalk.dim('── manage entries ──────────────────')),
        {
          name:     chalk.blueBright('⏰  Set time for entry'),
          value:    'time',
          disabled: !hasEntries,
        },
        {
          name:     chalk.magentaBright('✏   Edit entry title'),
          value:    'edit',
          disabled: !hasEntries,
        },
        {
          name:     chalk.red('🗑   Remove entry'),
          value:    'remove',
          disabled: !hasEntries,
        },
        new inquirer.Separator(chalk.dim('── day management ──────────────────')),
        {
          name:  chalk.yellowBright('📅  Switch date'),
          value: 'date',
        },
        {
          name:     chalk.dim('🔄  Reset all to Pending'),
          value:    'reset',
          disabled: !hasEntries,
        },
        new inquirer.Separator(chalk.dim('────────────────────────────────────')),
        {
          name:  chalk.dim('❌  Exit'),
          value: 'exit',
        },
      ],
    }]);

    if (action === 'exit') {
      console.log(chalk.dim('\n  See you later! 👋\n'));
      process.exit(0);
    }

    switch (action) {
      case 'add':       await handleAdd(dateKey);              break;
      case 'done':
      case 'skipped':
      case 'cancelled':
      case 'pending':   await handleSetStatus(dateKey, action, entries); break;
      case 'time':      await handleSetTime(dateKey, entries); break;
      case 'edit':      await handleEdit(dateKey, entries);    break;
      case 'remove':    await handleRemove(dateKey, entries);  break;
      case 'reset':     await handleReset(dateKey);            break;
      case 'date':      dateKey = await handleSwitchDate();    break;
    }
  }
}

module.exports = { startInteractive };
