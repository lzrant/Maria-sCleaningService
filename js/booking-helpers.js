import { addDays, addMonths, getAssignableEmployees, isDateKey, parseDateKey, toDateKey } from './utils.js';
import { showModal, uiAlert } from './ui.js';

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

export async function promptForBookingDetails({
  title = 'Booking Details',
  message = 'Add the required schedule information.',
  defaultDate,
  defaultType = 'houses',
  defaultLocation = '',
  defaultNotes = 'Routine',
  showType = true
} = {}) {
  const employees = getAssignableEmployees();
  const fields = [
    ...(showType
      ? [
          {
            name: 'type',
            label: 'Booking type',
            type: 'select',
            value: defaultType,
            required: true,
            options: [
              { value: 'houses', label: 'House' },
              { value: 'offices', label: 'Office' }
            ]
          }
        ]
      : []),
    {
      name: 'date',
      label: 'Date',
      type: 'date',
      value: defaultDate,
      required: true
    },
    {
      name: 'time',
      label: 'Time',
      type: 'text',
      placeholder: '2:30 PM',
      required: true
    },
    {
      name: 'location',
      label: 'Location',
      type: 'text',
      value: defaultLocation,
      required: true
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      value: defaultNotes
    },
    {
      name: 'repeatType',
      label: 'Repeat frequency',
      type: 'select',
      value: 'none',
      required: true,
      options: [
        { value: 'none', label: 'Does not repeat' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'biweekly', label: 'Bi-weekly' },
        { value: 'monthly', label: 'Monthly' }
      ]
    },
    {
      name: 'occurrences',
      label: 'Total visits',
      type: 'number',
      value: '1',
      min: '1',
      max: '365',
      step: '1',
      required: true
    },
    ...(employees.length
      ? [
          {
            name: 'assignedEmployees',
            label: 'Assigned employees',
            type: 'checkbox-group',
            options: employees.map((employee) => ({
              value: employee.name,
              label: employee.name
            }))
          }
        ]
      : [])
  ];

  const result = await showModal({
    title,
    message,
    confirmText: 'Save Booking',
    fields
  });

  if (!result.confirmed) return null;

  const date = result.values.date;
  const time = result.values.time.trim();
  const location = result.values.location.trim();
  if (!isDateKey(date) || !time || !location) {
    await uiAlert('Date, time, and location are required.');
    return promptForBookingDetails({
      title,
      message,
      defaultDate,
      defaultType,
      defaultLocation,
      defaultNotes,
      showType
    });
  }

  const repeatType = result.values.repeatType || 'none';
  const occurrences = repeatType === 'none' ? 1 : Number(result.values.occurrences);
  if (!Number.isInteger(occurrences) || occurrences < 1 || occurrences > 365) {
    await uiAlert('Total visits must be a whole number between 1 and 365.');
    return promptForBookingDetails({
      title,
      message,
      defaultDate,
      defaultType,
      defaultLocation,
      defaultNotes,
      showType
    });
  }

  return {
    type: result.values.type || defaultType,
    date,
    time,
    location,
    notes: result.values.notes.trim() || 'Routine',
    assignedEmployees: result.values.assignedEmployees || [],
    repeat: { repeatType, occurrences }
  };
}
