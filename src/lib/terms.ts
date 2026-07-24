import { useTheme } from '@/hooks/use-theme';

export type TermSet = {
  appTagline: string;
  protocols: string;
  protocolsHint: string;
  protocolsPlaceholder: string;
  subjects: string;
  subject: string;
  subjectPlaceholder: string;
  weekly: string;
  weeklyPlaceholder: string;
  weeklyEmpty: string;
  daily: string;
  dailyPlaceholder: string;
  dailyEmpty: string;
  commitments: string;
  commitmentsPlaceholder: string;
  commitmentsEmpty: string;
  events: string;
  addEvent: string;
  ai: string;
  aiNext: string;
  aiSummary: string;
  aiInputNext: string;
  aiInputSummary: string;
  inProgress: string;
  done: string;
  doneStat: string;
  history: string;
  clear: string;
  logout: string;
  heroBadge: string;
  ringLabel: string;
  greeting: (hour: number) => string;
};

const flight: TermSet = {
  appTagline: 'Your daily flight deck',
  protocols: 'Flight Protocols',
  protocolsHint: 'Rules to follow throughout the day',
  protocolsPlaceholder: 'e.g. No phone during study...',
  subjects: 'Routes',
  subject: 'Route',
  subjectPlaceholder: 'Add a route...',
  weekly: 'Flight Plan',
  weeklyPlaceholder: 'Set a waypoint...',
  weeklyEmpty: 'No flight plan yet. Add routes first, then set waypoints.',
  daily: "Today's Flight",
  dailyPlaceholder: 'Next destination...',
  dailyEmpty: 'No flights scheduled for today yet.',
  commitments: 'Scheduled Stops',
  commitmentsPlaceholder: 'Where to...',
  commitmentsEmpty: 'No scheduled stops today.',
  events: 'Upcoming Events',
  addEvent: 'Add Event',
  ai: 'Control Tower',
  aiNext: 'Next Heading',
  aiSummary: 'Debrief',
  aiInputNext: "Status update? (e.g. 'Just finished chapter 3')",
  aiInputSummary: 'Any notes about your flight today?',
  inProgress: 'In Flight',
  done: 'Landed',
  doneStat: 'landed',
  history: 'Flight Log',
  clear: 'Clear Runway',
  logout: 'Disembark',
  heroBadge: 'Flight Deck',
  ringLabel: 'Today',
  greeting: (h) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'),
};

const war: TermSet = {
  appTagline: 'Your ops command deck',
  protocols: 'Ops Protocols',
  protocolsHint: 'Rules to follow throughout the day',
  protocolsPlaceholder: 'e.g. No phone during study...',
  subjects: 'Fronts',
  subject: 'Front',
  subjectPlaceholder: 'Add a front...',
  weekly: 'Battle Plan',
  weeklyPlaceholder: 'Set an objective...',
  weeklyEmpty: 'No battle plan yet. Add fronts first, then set objectives.',
  daily: "Today's Ops",
  dailyPlaceholder: 'Next objective...',
  dailyEmpty: 'No operations scheduled for today yet.',
  commitments: 'Schedule',
  commitmentsPlaceholder: 'Where to...',
  commitmentsEmpty: 'No commitments today.',
  events: 'Upcoming Events',
  addEvent: 'Add Event',
  ai: 'Command HQ',
  aiNext: 'Next Move',
  aiSummary: 'Debrief',
  aiInputNext: "Status update? (e.g. 'Just finished chapter 3')",
  aiInputSummary: "Any notes about today's ops?",
  inProgress: 'Engaged',
  done: 'Secured',
  doneStat: 'secured',
  history: 'War Log',
  clear: 'Clear Field',
  logout: 'Retreat',
  heroBadge: 'Ops Briefing',
  ringLabel: 'Mission',
  greeting: (h) => (h < 12 ? 'Morning briefing' : h < 17 ? 'Afternoon ops' : 'Night watch'),
};

const plain: TermSet = {
  appTagline: 'Your daily planner',
  protocols: 'Daily Rules',
  protocolsHint: 'Rules to follow throughout the day',
  protocolsPlaceholder: 'e.g. No phone during study...',
  subjects: 'Subjects',
  subject: 'Subject',
  subjectPlaceholder: 'Add a subject...',
  weekly: 'Weekly Targets',
  weeklyPlaceholder: 'Add a target...',
  weeklyEmpty: 'No weekly targets yet. Add subjects first, then set targets.',
  daily: "Today's Tasks",
  dailyPlaceholder: 'Add a task...',
  dailyEmpty: 'No tasks for today yet.',
  commitments: 'Schedule',
  commitmentsPlaceholder: 'Where to...',
  commitmentsEmpty: 'Nothing scheduled today.',
  events: 'Upcoming Events',
  addEvent: 'Add Event',
  ai: 'AI Advisor',
  aiNext: "What's Next",
  aiSummary: 'Summary',
  aiInputNext: "Status update? (e.g. 'Just finished chapter 3')",
  aiInputSummary: 'Any notes about your day?',
  inProgress: 'In Progress',
  done: 'Completed',
  doneStat: 'done',
  history: 'History',
  clear: 'Clear Day',
  logout: 'Sign out',
  heroBadge: 'Today',
  ringLabel: 'Today',
  greeting: (h) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'),
};

export function useTerms(): TermSet {
  const { theme } = useTheme();
  if (theme === 'flight') return flight;
  if (theme === 'war') return war;
  return plain;
}
