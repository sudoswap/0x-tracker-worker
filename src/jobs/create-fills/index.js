const bluebird = require('bluebird');
const signale = require('signale');

const {
  MissingBlockError,
  UnsupportedAssetError,
  UnsupportedProtocolError,
} = require('../../errors');
const createFill = require('./create-fill');
const ensureTokenExists = require('../../tokens/ensure-token-exists');
const Event = require('../../model/event');
const persistFill = require('./persist-fill');

const logger = signale.scope('create fills');

const createFills = async ({ batchSize }) => {
  const events = await Event.find({
    fillCreated: { $in: [false, null] },
  }).limit(batchSize);

  logger.info(`found ${events.length} events without associated fills`);

  await bluebird.mapSeries(events, async event => {
    logger.time(`create fill for event ${event.id}`);

    try {
      const fill = await createFill(event);

      if (await ensureTokenExists(fill.makerToken)) {
        logger.success(`created token: ${fill.makerToken}`);
      }

      if (await ensureTokenExists(fill.takerToken)) {
        logger.success(`created token: ${fill.takerToken}`);
      }

      logger.time(`persist fill for event ${event._id}`);
      await persistFill(event, fill);
      logger.timeEnd(`persist fill for event ${event._id}`);

      logger.timeEnd(`create fill for event ${event.id}`);
    } catch (error) {
      if (error instanceof MissingBlockError) {
        logger.warn(
          `Unable to create fill for event ${event.id} due to missing block`,
        );
      } else if (error instanceof UnsupportedAssetError) {
        // ignore
      } else if (error instanceof UnsupportedProtocolError) {
        logger.warn(
          `Unable to create fill for event ${event.id} due to unsupported protocol`,
        );
      } else {
        throw error;
      }
    }
  });
};

module.exports = createFills;
