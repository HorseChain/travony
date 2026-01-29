const riderConfig = require('./app.rider.json');
const driverConfig = require('./app.driver.json');
const unifiedConfig = require('./app.json');

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT;
  
  if (variant === 'rider') {
    return riderConfig.expo;
  }
  
  if (variant === 'driver') {
    return driverConfig.expo;
  }
  
  return unifiedConfig.expo;
};
