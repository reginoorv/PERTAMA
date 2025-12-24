
export type UserRole = "admin" | "cashier";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface UnitConversion {
  id: string;
  unitName: string;
  conversionFactor: number; // 1 slop = 10 bungkus, factor = 10
  sellPrice: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  barcode: string;
  costPrice: number; // Modal satuan terkecil
  sellPrice: number; // Harga jual satuan terkecil
  stock: number;     // Stok dalam satuan terkecil
  unit: string;      // Nama satuan terkecil
  conversions: UnitConversion[]; 
  imageUrl?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export type PaymentType = "cash" | "debt";

export interface Sale {
  id: string;
  dateTime: string;
  customerId?: string;
  cashierUserId: string;
  totalAmount: number;
  paymentType: PaymentType;
  paidAmount: number;
  changeAmount: number;
  note?: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitName: string;         // Satuan yang dipilih (slop/bungkus)
  conversionFactor: number; // Pengali ke satuan dasar
  unitPrice: number;
  totalPrice: number;
  costPrice: number; 
}

export interface Debt {
  id: string;
  customerId: string;
  saleId: string;
  amount: number;
  createdAt: string;
}

export interface DebtPayment {
  id: string;
  customerId: string;
  amount: number;
  dateTime: string;
  note?: string;
}

export interface Settings {
  storeName: string;
  storeAddress: string;
  storePhone?: string;
  receiptFooterNote?: string;
}

export interface CartItem extends Product {
  qty: number;
  selectedUnit: {
    unitName: string;
    factor: number;
    price: number;
  };
}
