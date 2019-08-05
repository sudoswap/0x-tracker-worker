const bluebird = require('bluebird');
const signale = require('signale');

const { getToken } = require('../../tokens/token-cache');
const formatTokenAmount = require('../../tokens/format-token-amount');
const getConversionRate = require('../../rates/get-conversion-rate');
const getMeasurableActor = require('./get-measurable-actor');
const normalizeSymbol = require('../../tokens/normalize-symbol');

const logger = signale.scope('measure fill');

const measureFill = async fill => {
  const measurableActor = getMeasurableActor(fill);

  let totalValue = 0;

  await bluebird.mapSeries(fill.assets, async asset => {
    if (asset.actor === measurableActor) {
      const token = getToken(asset.tokenAddress);

      if (token === undefined) {
        throw new Error(
          `Unable to fetch resolved token ${asset.tokenAddress} from token cache`,
        );
      }

      const amount = formatTokenAmount(asset.amount, token);
      const normalizedSymbol = normalizeSymbol(token.symbol);
      const conversionRate = await getConversionRate(
        normalizedSymbol,
        'USD',
        fill.date,
      );

      if (conversionRate === undefined) {
        throw new Error(
          `Unable to fetch USD price of ${normalizedSymbol} on ${fill.date}`,
        );
      }

      asset.set('price.USD', conversionRate);

      logger.debug(
        `set price of token ${token.address} to ${conversionRate} on fill ${fill._id}`,
      );

      totalValue += amount * conversionRate;
    }
  });

  fill.set('conversions.USD.amount', totalValue);
  fill.set('hasValue', true);
  await fill.save();

  logger.debug(`set value of fill ${fill._id} to ${totalValue}`);
};

module.exports = measureFill;