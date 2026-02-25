// services/shippingService.js
const LogisticsRate = require('../models/LogisticsRate');
const LogisticsPartner = require('../models/LogisticsPartner');
const CustomerShippingRule = require('../models/CustomerShippingRule');

/**
 * 1. Customer-Facing Calculation (At Checkout)
 * Ignores items marked as free shipping for the customer's cost.
 */
exports.calculateCustomerShippingFee = async (cartItems, destinationZone) => {
  let chargeableWeight = 0;
  let customerFee = 0;

  // Calculate weight only for items that DO NOT have free shipping
  cartItems.forEach(item => {
    if (!item.product.isFreeShipping) {
      chargeableWeight += (item.product.weight * item.quantity);
    }
  });

  // If everything in the cart is free shipping
  if (chargeableWeight === 0) return 0;

  // Fetch the dynamic rule you set in the admin panel for the customer
  const rule = await CustomerShippingRule.findOne({ destinationZone });
  
  if (rule) {
    customerFee = rule.baseFee + (chargeableWeight > 1 ? (chargeableWeight - 1) * rule.perKgFee : 0);
  }

  return customerFee;
};

/**
 * 2. Internal Logistics Cost Calculation
 * Calculates what you will pay Pathao based on TOTAL weight (even free shipping items).
 */
exports.calculateInternalShippingCost = async (cartItems, totalCartValue, originZone, destinationZone, partnerId, isCOD) => {
  let totalWeight = 0;

  // Internal logistics charges you based on physical weight, regardless of 'Free Shipping' tags
  cartItems.forEach(item => {
    totalWeight += (item.product.weight * item.quantity);
  });

  const rateChart = await LogisticsRate.findOne({ partnerId, originZone, destinationZone });
  const partnerInfo = await LogisticsPartner.findById(partnerId);

  if (!rateChart) throw new Error("Logistics rate not found for these zones");

  let shippingCost = 0;

  // A. Find the base cost from the dynamic weight tiers
  const matchedTier = rateChart.weightTiers.find(
    tier => totalWeight > tier.minWeight && totalWeight <= tier.maxWeight
  );

  if (matchedTier) {
    shippingCost = matchedTier.cost;
  } else if (totalWeight > rateChart.extraWeightRules.applyAfterKg) {
    // B. Calculate extra weight (e.g., > 2KG)
    // First, get the max tier base cost
    const maxTier = rateChart.weightTiers[rateChart.weightTiers.length - 1];
    shippingCost = maxTier.cost;

    // Calculate extra KGs (rounded up to nearest Kg)
    const extraKg = Math.ceil(totalWeight - rateChart.extraWeightRules.applyAfterKg);
    shippingCost += (extraKg * rateChart.extraWeightRules.costPerExtraKg);
  }

  // C. Calculate COD Charges (Platform bears this, as per your instruction)
  let codCharge = 0;
  if (isCOD) {
    codCharge = (totalCartValue * (partnerInfo.codChargePercentage / 100));
  }

  // D. Calculate Potential Return Charge 
  let potentialReturnCharge = 0;
  if (partnerInfo.returnChargeRules.customerBearsCost) {
    const isExempt = partnerInfo.returnChargeRules.exemptZones.includes(destinationZone);
    if (!isExempt) {
      potentialReturnCharge = shippingCost; // Customer bears the delivery cost as return fee
    }
  }

  return {
    internalShippingCost: shippingCost,
    platformCodChargeBorne: codCharge,
    potentialCustomerReturnFee: potentialReturnCharge
  };
};