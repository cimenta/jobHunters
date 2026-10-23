export type RouteName = 'dashboard' | 'jobs' | 'job-new' | 'job' | 'applications' | 'application' | 'companies' | 'company' | 'calendar' | 'emails' | 'email' | 'tasks' | 'settings' | 'help' | 'not-found';
export type Section = 'dashboard' | 'jobs' | 'applications' | 'companies' | 'calendar' | 'emails' | 'tasks' | 'settings' | 'help';
export interface Route {
  name: RouteName;
  id?: string;
  query: Record<string, string>;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function parseRoute(hash: string): Route {
  const [path = '', queryText = ''] = hash.replace(/^#/, '').split('?');
  const query = Object.create(null) as Record<string, string>;
  for (const pair of queryText.split('&')) {
    if (pair === '') continue;
    const [key = '', value = ''] = pair.split('=');
    if (key !== '__proto__') query[safeDecode(key)] = safeDecode(value);
  }
  const parts = path.split('/').filter((part) => part !== '').map(safeDecode);
  const [first, second, third] = parts;
  const route = (name: RouteName, id?: string): Route => (id === undefined ? { name, query } : { name, id, query });
  if (first === undefined) return route('dashboard');
  if (third !== undefined) return route('not-found');
  if (first === 'jobs') return second === undefined ? route('jobs') : second === 'new' ? route('job-new') : route('job', second);
  if (first === 'applications') return second === undefined ? route('applications') : route('application', second);
  if (first === 'companies') return second === undefined ? route('companies') : route('company', second);
  if (first === 'calendar' && second === undefined) return route('calendar');
  if (first === 'emails') return second === undefined ? route('emails') : route('email', second);
  if (first === 'tasks' && second === undefined) return route('tasks');
  if (first === 'settings' && second === undefined) return route('settings');
  if (first === 'help' && second === undefined) return route('help');
  return route('not-found');
}

export function sectionOf(route: Route): Section {
  switch (route.name) {
    case 'jobs':
    case 'job-new':
    case 'job':
      return 'jobs';
    case 'applications':
    case 'application':
      return 'applications';
    case 'companies':
    case 'company':
      return 'companies';
    case 'calendar':
      return 'calendar';
    case 'emails':
    case 'email':
      return 'emails';
    case 'tasks':
      return 'tasks';
    case 'settings':
      return 'settings';
    case 'help':
      return 'help';
    default:
      return 'dashboard';
  }
}

const enc = encodeURIComponent;
export const paths = {
  dashboard: '#/',
  jobs: '#/jobs',
  newJob: '#/jobs/new',
  applications: '#/applications',
  companies: '#/companies',
  calendar: '#/calendar',
  emails: '#/emails',
  tasks: '#/tasks',
  settings: '#/settings',
  help: '#/help',
  job: (id: string) => `#/jobs/${enc(id)}`,
  application: (id: string) => `#/applications/${enc(id)}`,
  company: (id: string) => `#/companies/${enc(id)}`,
  email: (id: string) => `#/emails/${enc(id)}`,
  applicationsWithStatus: (status: string) => `#/applications?status=${enc(status)}`,
};
