export type Invoice = { id:string; invoice_number:string; shop_id:string; shop_name:string; customer_id:string|null; customer_name:string; customer_phone?:string; items:any[]; subtotal:number; discount:number; coupon_code?:string; gst:number; total:number; amount_paid:number; balance_due:number; payment_method:string; status:string; created_at:string; storage_path?:string; storage_url?:string; local_file_uri?:string; [key:string]:any };
export type Customer = { id:string; shop_id:string; name:string; phone:string; total_purchases:number; total_paid?:number; total_due:number; invoices:Invoice[]; [key:string]:any };
export type Product = { id:string; shop_id:string; name:string; selling_price:number; cost_price:number; stock:number; min_stock:number; category:string; sku:string; gst:number; icon:string; tint:string; [key:string]:any };
export type Coupon = {
  id:string;
  code:string;
  discount:number;
  discountType:"fixed"|"percentage";
  enabled:boolean;
  isActive?:boolean;
  minimumPurchase?:number;
  maximumDiscount?:number;
  startDate?:string;
  endDate?:string;
  expiryDate?:string;
  usageLimit?:number;
  usageCount?:number;
  applicableCategory?:string;
  applicableSubcategory?:string;
  applicableProductIds?:string[];
  branchIds?:string[];
  createdAt?:string;
  updatedAt?:string;
  [key:string]:any
};
export type Staff = { id:string; name:string; role:string; phone:string; status:"active"|"disabled"|"deleted"; shop_id?:string; [key:string]:any };
export type Attendance = { id:string; staffId:string; date:string; status:"present"|"absent"; shop_id?:string; [key:string]:any };
export type ServiceRecord = { id:string; shop_id:string; customerName:string; customerPhone:string; product:string; complaint:string; expectedDelivery:string; serviceName:string; price:number; conditionPhoto?:string; createdAt:string; updatedAt?:string; status?:"PENDING"|"READY"; excelArchiveStatus?:"PENDING"|"ARCHIVED"|"FAILED"; [key:string]:any };
export type ReturnRecord = { id:string; invoice_id:string; invoice_number:string; shop_id:string; customer_id:string|null; customer_name:string; refund_amount:number; payment_method:string; reason:string; created_at:string };
export type Activity = { id:string; uid:string; branchId?:string; action:string; entityType:string; entityId:string; description:string; createdAt:string; createdBy:string };


export const normalizeRecord=(name:string,row:any)=>{
  const common={id:row.id,...row,created_at:row.created_at??row.createdAt,createdAt:row.createdAt??row.created_at,updated_at:row.updated_at??row.updatedAt,updatedAt:row.updatedAt??row.updated_at};
  if(name==="customers")return {...common,phone:row.phone??row.customerPhone??"",gstin:row.gstin??row.gstIn??row.customerGstin??row.customer_gstin??"",address:row.address??row.customerAddress??"",total_due:Number(row.total_due??row.outstanding??0),outstanding:Number(row.outstanding??row.total_due??0)};
  if(name==="products")return {...common,selling_price:row.selling_price??row.price??0,cost_price:row.cost_price??row.cost??0,min_stock:row.min_stock??row.lowStockAlert??5,stock:Number(row.stock??0)};
  if(name==="coupons")return {...common,discountType:row.discountType??row.type??"fixed",discount:Number(row.discount??row.value??0),minimumPurchase:row.minimumPurchase??row.minPurchase,usageCount:Number(row.usageCount??row.used??0),expiryDate:row.expiryDate??row.expiry,enabled:row.enabled??(row.active!==false)};
  if(name==="invoices"){const rawStatus=row.paymentStatus??row.payment_status??row.status;return {...common,invoice_number:row.invoice_number??row.invoiceNumber,customer_id:row.customer_id??row.customerId??null,customer_name:row.customer_name??row.customerName??"Walk-in Customer",customer_phone:row.customer_phone??row.customerPhone??null,customer_email:row.customer_email??row.customerEmail??null,customer_address:row.customer_address??row.customerAddress??null,customer_gstin:row.customer_gstin??row.customerGstin??null,total:Number(row.total??row.grandTotal??row.grand_total??0),gst:Number(row.gst??row.tax??0),subtotal:Number(row.subtotal??row.taxable??0),discount:Number(row.discount??row.totalDiscount??0),amount_paid:Number(row.amount_paid??row.paidAmount??row.paid_amount??0),balance_due:Number(row.balance_due??row.balance??row.pendingAmount??row.pending_amount??0),payment_method:row.payment_method??row.paymentMethod??"",status:rawStatus==="unpaid"?"due":rawStatus,items:(row.items||[]).map((item:any)=>({...item,product_id:item.product_id??item.productId,quantity:Number(item.quantity??item.qty??0)}))};}
  return common;
};
