export const state = {
  store: {
    inventory: [],
    employees: [],
    employeeSchedule: [],
    houseOfficeSchedule: { houses: [], offices: [] },
    clients: [],
    timesheets: []
  },
  currentUser: null,
  calendarCursor: new Date(),
  selectedDateKey: '',
  clientSearchTerm: ''
};
