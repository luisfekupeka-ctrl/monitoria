export type UserRole = 'admin' | 'operator';

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  approved?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  code: string;
  quantity: number;
  minQuantity: number;
  unit: string;
}

export interface Notebook {
  id: string;
  code: string;
  type: 'notebook' | 'mouse' | 'charger' | 'headphones' | 'mesa';
  status: 'available' | 'loaned' | 'maintenance';
  createdBy?: string;
  laboratory?: string;
}

export type BeneficiaryType = 'professor' | 'collaborator' | 'student' | 'location';

export interface Beneficiary {
  id: string;
  name: string;
  type: BeneficiaryType;
  department?: string; // Optional field for subject or department
  phone?: string;
}

export interface Loan {
  id: string;
  beneficiaryId: string;
  beneficiaryName: string;
  items: string[]; // List of notebook codes
  loanDate: string;
  returnDate?: string;
  operatorId: string;
  operatorName: string;
  returned_at?: string;
  status: 'active' | 'completed';
  returnDeadline?: string;
}

export interface Schedule {
  id: string;
  professorId: string;
  equipmentCodes: string[];
  scheduledDate: string;
  startTime: string;
  returnDeadline?: string;
  status: 'pending' | 'active' | 'cancelled' | 'completed';
  createdBy?: string;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  date: string;
  operatorId: string;
  operatorName: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
}
