import { addDays, addMonths, parseDateKey, toDateKey } from './utils.js';
import { uiAlert, uiPrompt, uiSelect } from './ui.js';

function getRepeatDayStep(repeatType) {
  if (repeatType === 'daily') return 1;
  if (repeatType === 'weekly') return 7;
  if (repeatType === 'biweekly') return 14;
  return 0;
}

export function buildRepeatDates(startDateKey, repeatType, occurrences) {
  const startDate = parseDateKey(startDateKey);
  if (!startDate) return [];

  const total = Number(occurrences);
  const safeTotal = Number.isInteger(total) && total > 0 ? total : 1;
  const dates = [];

  if (repeatType === 'monthly') {
    for (let index = 0; index < safeTotal; index += 1) {
      dates.push(toDateKey(addMonths(startDate, index)));
    }
    return dates;
  }

  const step = getRepeatDayStep(repeatType);
  if (step <= 0) {
    return [toDateKey(startDate)];
  }

  for (let index = 0; index < safeTotal; index += 1) {
    dates.push(toDateKey(addDays(startDate, step * index)));
  }

  return dates;
}

export async function askRepeatSettings() {
  const repeatType = await uiSelect(
    'How often should this booking repeat?',
    [
      { value: 'none', label: 'Does not repeat' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'biweekly', label: 'Bi-weekly' },
      { value: 'monthly', label: 'Monthly' }
    ],
    'none',
    { label: 'Repeat frequency' }
  );

  if (repeatType === null) return null;
  if (repeatType === 'none') return { repeatType, occurrences: 1 };

  const occurrencesRaw = await uiPrompt('How many total occurrences?', '4', {
    label: 'Occurrences',
    type: 'number'
  });
  if (occurrencesRaw === null) return null;

  const occurrences = Number(occurrencesRaw);
  if (!Number.isInteger(occurrences) || occurrences < 1 || occurrences > 365) {
    await uiAlert('Occurrences must be a whole number between 1 and 365.');
    return askRepeatSettings();
  }

  return { repeatType, occurrences };
}
