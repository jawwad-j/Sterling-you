// products.js
var products = [
    {
        id: 1,
        sku: "ST-CL-EM-001",           // NEW: SKU for inventory tracking
        name: "Emerald Velvet Clutch",
        brand: "Sterling Premium",
        category: "Clutch Bags",
        subCategory: "Evening Clutches",
        costPrice: 4500,               // Landing Cost
        price: 8500,                   // Selling Price (BDT)
        originalPrice: 10000, 
        isSale: true,
        isNew: true,
        isVisible: true,               // NEW: Website visibility toggle
        weightGm: 600,
        weight: 0.6,                   // NEW: Weight in Kg for shipping calculation
        isFreeDelivery: false,
        isFreeShipping: false,         // NEW: Free shipping toggle for checkout calculation
        deliveryPayer: "Customer",      // NEW: Delivery responsibility logic
        dateAdded: "2026-02-01",
        stock: 3,                      // Trigger: Low Stock Alert (< 5)
        isAvailable: true,
        soldCount: 15,
        returnsCount: 1,
        discardedCount: 0,
        sizes: [], 
        image: "images/clutch1.jpg"
    },
    {
        id: 2,
        sku: "ST-TO-SG-002",
        name: "Signature Tote",
        brand: "Sterling",
        category: "Handbags",
        subCategory: "Satchel/Tote Bags",
        costPrice: 6500,
        price: 12500,
        originalPrice: null,
        isSale: false,
        isNew: true,
        isVisible: true,
        weightGm: 1200,
        weight: 1.2,                   // NEW: Weight in Kg for shipping calculation
        isFreeDelivery: true,
        isFreeShipping: true,          // NEW: Free shipping toggle for checkout calculation
        deliveryPayer: "Sterling",
        dateAdded: "2026-02-06",
        stock: 12,
        isAvailable: true,
        soldCount: 5,
        returnsCount: 0,
        discardedCount: 1,
        sizes: [],
        image: "images/bag-2.png"
    },
    {
        id: 3,
        sku: "LT-HT-PS-003",
        name: "Professional Hair Straightener",
        brand: "LuxeTech",
        category: "Accessories",
        subCategory: "Hair Tools",
        costPrice: 3800,
        price: 7500,
        originalPrice: 8900,
        isSale: true,
        isNew: true,
        isVisible: true,
        weightGm: 800,
        weight: 0.8,                   // NEW: Weight in Kg for shipping calculation
        isFreeDelivery: false,
        isFreeShipping: false,         // NEW: Free shipping toggle for checkout calculation
        deliveryPayer: "Customer",
        dateAdded: "2026-02-04",
        stock: 0,                       // Trigger: Automatic "SOLD OUT"
        isAvailable: true,
        soldCount: 20,
        returnsCount: 2,
        discardedCount: 0,
        sizes: [],
        image: "images/hair-straightener.png"
    },
    {
        id: 4,
        sku: "AL-SH-VP-004",
        name: "Velvet Party Shoes",
        brand: "Aldo",
        category: "Shoes",
        subCategory: "Heels",
        costPrice: 1800,
        price: 3500,
        originalPrice: 5000,
        isSale: true,
        isNew: true,
        isVisible: true,
        weightGm: 950,
        weight: 0.95,                  // NEW: Weight in Kg for shipping calculation
        isFreeDelivery: false,
        isFreeShipping: false,         // NEW: Free shipping toggle for checkout calculation
        deliveryPayer: "Customer",
        dateAdded: "2026-01-20",
        stock: 8,
        isAvailable: false,             // Trigger: Manual "SOLD OUT"
        soldCount: 45,
        returnsCount: 5,
        discardedCount: 0,
        sizes: [36, 37, 38, 39, 40],
        image: "images/Shoes-product.png"
    },
    {
        id: 5,
        sku: "ST-WA-SS-005",
        name: "Slim Saffiano Wallet",
        brand: "Sterling",
        category: "Handbags",
        subCategory: "Wallets",
        costPrice: 1200,
        price: 3200,
        originalPrice: 4500,
        isSale: true,
        isNew: false,
        isVisible: true,
        weightGm: 200,
        weight: 0.2,                   // NEW: Weight in Kg for shipping calculation
        isFreeDelivery: false,
        isFreeShipping: false,         // NEW: Free shipping toggle for checkout calculation
        deliveryPayer: "Customer",
        dateAdded: "2026-01-10",
        stock: 25,
        isAvailable: true,
        soldCount: 10,
        returnsCount: 0,
        discardedCount: 0,
        sizes: [],
        image: "images/wallet-1.png"
    },
    {
        id: 6,
        sku: "ST-AC-GM-006",
        name: "Gold Monogram Charm",
        brand: "Sterling",
        category: "Handbags",
        subCategory: "Bag Charms",
        costPrice: 450,
        price: 1500,
        originalPrice: null,
        isSale: false,
        isNew: true,
        isVisible: true,
        weightGm: 50,
        weight: 0.05,                  // NEW: Weight in Kg for shipping calculation
        isFreeDelivery: false,
        isFreeShipping: false,         // NEW: Free shipping toggle for checkout calculation
        deliveryPayer: "Customer",
        dateAdded: "2026-02-05",
        stock: 50,
        isAvailable: true,
        soldCount: 2,
        returnsCount: 0,
        discardedCount: 0,
        sizes: [],
        image: "images/charm-1.png"
    }
];

// NEW: Shared Expenses for Net Profit Calculation
var expenses = [
    { id: 1, category: "Marketing", amount: 5000, date: "2026-02-01", description: "Facebook Ads" },
    { id: 2, category: "Operations", amount: 2000, date: "2026-02-02", description: "Packaging materials" }
];

console.log("Sterling Product Catalog and Expenses loaded. Ready for ERP calculation.");