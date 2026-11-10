export type UserRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  storeName?: string;
  role: UserRole;
  pin?: string; // 4-digit PIN
  photoUrl?: string;
  setupCompleted?: boolean;
  assignedBranchId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Branch {
  id: string;
  ownerId: string;
  name: string;
  address?: string;
  phone?: string;
  openingHours?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type TableStatus = 'empty' | 'occupied' | 'bill' | 'cleaning';

export interface TableItem {
  id: string;
  branchId: string;
  ownerId?: string;
  name: string;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
  x?: number; // visual coordinates for table layout
  y?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  branchId?: string;
  ownerId?: string;
  name: string;
  icon?: string;
  sortOrder?: number;
  createdAt?: string;
}

export interface VariantOption {
  name: string;
  priceDelta: number;
}

export interface MenuVariant {
  id: string;
  name: string;
  options: VariantOption[];
}

export interface RecipeIngredient {
  inventoryId: string;
  ingredientName: string;
  amount: number;
  unit: string;
}

export interface MenuItem {
  id: string;
  branchId?: string;
  ownerId?: string;
  categoryId?: string;
  name: string;
  price: number;
  costPrice?: number;
  description?: string;
  photoUrl?: string;
  isAvailable: boolean;
  categoryType: 'food' | 'beverage' | 'other';
  variants?: MenuVariant[];
  recipe?: RecipeIngredient[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  menuId: string;
  name: string;
  price: number;
  costPrice?: number;
  quantity: number;
  categoryType: 'food' | 'beverage' | 'other';
  selectedVariants?: { [variantName: string]: string };
  notes?: string;
}

export type OrderStatus = 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export interface Order {
  id: string;
  branchId: string;
  ownerId?: string;
  tableId?: string;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  serviceCharge: number;
  tax: number;
  discount: number;
  voucherCode?: string;
  total: number;
  status: OrderStatus;
  type: OrderType;
  cashierId?: string;
  cashierName?: string;
  paymentMethod?: string; // Tunai, QRIS, Transfer, Debit, Kredit, Utang
  paymentStatus: PaymentStatus;
  cashGiven?: number;
  changeAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  branchId: string;
  ownerId?: string;
  name: string;
  unit: string; // kg, gr, liter, ml, pcs, porsi
  currentStock: number;
  minStock: number;
  photoUrl?: string;
  supplier?: string;
  costPerUnit?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryTransaction {
  id: string;
  branchId: string;
  inventoryId: string;
  ingredientName: string;
  type: 'in' | 'out' | 'opname' | 'transfer';
  amount: number;
  previousStock: number;
  newStock: number;
  notes?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  branchId?: string;
  ownerId?: string;
  name: string;
  phone: string;
  points: number;
  totalSpent: number;
  orderCount: number;
  birthDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reservation {
  id: string;
  branchId: string;
  ownerId?: string;
  tableId?: string;
  tableName?: string;
  customerName: string;
  customerPhone: string;
  reservationDate: string;
  reservationTime: string;
  guestCount: number;
  status: 'confirmed' | 'seated' | 'cancelled';
  notes?: string;
  createdAt?: string;
}

export interface StoreSetting {
  id: string;
  ownerId: string;
  storeName: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  taxRate: number; // default 10% PB1
  serviceChargeRate: number; // default 5%
  receiptFooter?: string;
  bluetoothPrinterName?: string;
  cashierPin?: string;
  updatedAt?: string;
}
