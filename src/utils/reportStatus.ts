// Report status management using localStorage
export interface ReportStatus {
  clientId: string;
  month: string; // Format: YYYY-MM
  markedAt: string; // ISO timestamp
}

const STORAGE_KEY = 'nuance_report_status';

export const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getReportStatuses = (): ReportStatus[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load report statuses from localStorage:', error);
    return [];
  }
};

export const saveReportStatuses = (statuses: ReportStatus[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  } catch (error) {
    console.warn('Failed to save report statuses to localStorage:', error);
  }
};

export const markReportAsDone = (clientId: string): void => {
  const currentMonth = getCurrentMonth();
  const statuses = getReportStatuses();
  
  // Remove any existing status for this client and month
  const filteredStatuses = statuses.filter(
    status => !(status.clientId === clientId && status.month === currentMonth)
  );
  
  // Add new status
  const newStatus: ReportStatus = {
    clientId,
    month: currentMonth,
    markedAt: new Date().toISOString()
  };
  
  filteredStatuses.push(newStatus);
  saveReportStatuses(filteredStatuses);
};

export const isReportDone = (clientId: string): boolean => {
  const currentMonth = getCurrentMonth();
  const statuses = getReportStatuses();
  
  return statuses.some(
    status => status.clientId === clientId && status.month === currentMonth
  );
};

export const cleanupOldStatuses = (): void => {
  const currentMonth = getCurrentMonth();
  const statuses = getReportStatuses();
  
  // Keep only current month statuses
  const currentStatuses = statuses.filter(status => status.month === currentMonth);
  saveReportStatuses(currentStatuses);
};