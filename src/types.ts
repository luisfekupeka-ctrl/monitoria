export type UserRole = 'admin' | 'operator';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
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
  type: 'notebook' | 'mouse' | 'charger' | 'headphones';
  status: 'available' | 'loaned' | 'maintenance';
}

export type BeneficiaryType = 'professor' | 'collaborator' | 'student' | 'location';

export interface Beneficiary {
  id: string;
  name: string;
  type: BeneficiaryType;
  department?: string; // Optional field for subject or department
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
  status: 'active' | 'returned';
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
