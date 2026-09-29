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
export interface TeacherRequest {
  id: string;
  professor_id: string;
  scheduled_date: string;
  start_time: string;
  return_deadline?: string;
  requested_items: Record<string, number>;
  status: 'pending' | 'approved' | 'rejected';
  destination?: string;
  observations?: string;
  created_at: string;
  professor?: {
    name: string;
  };
}

export type PurchaseStatus = 'pending' | 'approved' | 'rejected'; // pending = 'Em espera', approved = 'Aprovado', rejected = 'Reprovado'
export type PurchasePriority = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface PurchaseItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  reference_link: string;
  estimated_price?: number;
  has_technical_specs?: boolean;
  technical_specs?: string;
}

export interface PurchaseRequest {
  id: string;
  requester_name: string;
  requester_department?: string;
  requester_contact?: string;
  justification: string;
  priority?: PurchasePriority;
  items: PurchaseItem[];
  // Legacy / convenience single item fields:
  item_name?: string;
  quantity?: number;
  unit?: string;
  reference_link?: string;
  technical_specs?: string;
  estimated_price?: number;
  status: PurchaseStatus;
  rejection_reason?: string;
  approval_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at?: string;
}


