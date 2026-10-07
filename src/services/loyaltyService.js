const customerRepository = require('../repositories/customerRepository');
const { LOYALTY } = require('../constants/businessRules');
const { CUSTOMER_TYPE } = require('../constants/domain');

function awardLoyaltyPoints(customerId, total) {
  const customer = customerRepository.findById(customerId);
  let points = Math.floor(total * LOYALTY.POINTS_PER_REAL);
  if (customer.type === CUSTOMER_TYPE.PREMIUM) {
    points = points * LOYALTY.PREMIUM_POINTS_MULTIPLIER;
  }

  customer.points = customer.points + points;
  const reachedPremium =
    customer.type === CUSTOMER_TYPE.REGULAR && customer.points >= LOYALTY.PREMIUM_UPGRADE_POINTS;
  if (reachedPremium) {
    customer.type = CUSTOMER_TYPE.PREMIUM;
  }
  return points;
}

function reverseLoyaltyPoints(customerId, points) {
  const customer = customerRepository.findById(customerId);
  customer.points = Math.max(customer.points - points, 0);
}

module.exports = { awardLoyaltyPoints, reverseLoyaltyPoints };
