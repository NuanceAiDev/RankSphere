// Report status management using localStorage with client slug keys
export interface ReportDoneClients {
  [clientSlug: string]: string; // clientSlug -> month (YYYY-MM)
}

const STORAGE_KEY = 'report_done_clients';

export const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const generateClientSlug = (clientName: string): string => {
  return clientName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

export const getReportDoneClients = (): ReportDoneClients => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load report done clients from localStorage:', error);
    return {};
  }
};

export const saveReportDoneClients = (clients: ReportDoneClients): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch (error) {
    console.warn('Failed to save report done clients to localStorage:', error);
  }
};

export const markReportAsDone = (clientName: string): void => {
  const currentMonth = getCurrentMonth();
  const clientSlug = generateClientSlug(clientName);
  const clients = getReportDoneClients();
  
  // Add client with current month
  clients[clientSlug] = currentMonth;
  
  saveReportDoneClients(clients);
};

export const isReportDone = (clientName: string): boolean => {
  const currentMonth = getCurrentMonth();
  const clientSlug = generateClientSlug(clientName);
  const clients = getReportDoneClients();
  
  return clients[clientSlug] === currentMonth;
};

export const cleanupOldStatuses = (): void => {
  const currentMonth = getCurrentMonth();
  const clients = getReportDoneClients();
  
  // Keep only current month statuses, remove old ones
  const currentClients: ReportDoneClients = {};
  
  Object.entries(clients).forEach(([clientSlug, month]) => {
    if (month === currentMonth) {
      currentClients[clientSlug] = month;
    }
  });
  
  saveReportDoneClients(currentClients);
};