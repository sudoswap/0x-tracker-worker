const { Client } = require('@elastic/elasticsearch');
const Mock = require('@elastic/elasticsearch-mock');
const timekeeper = require('timekeeper');

const { getModel } = require('../model');
const { mockLogger, resetDb, setupDb, tearDownDb } = require('../test-utils');
const consumer = require('./index-fill');
const elasticsearch = require('../util/elasticsearch');

jest.mock('../util/elasticsearch');

const elasticsearchMock = new Mock();
const mockOptions = {
  logger: mockLogger,
};

beforeAll(async () => {
  const client = new Client({
    node: 'http://localhost:9200',
    Connection: elasticsearchMock.getConnection(),
  });

  elasticsearch.getClient.mockReturnValue(client);
  await setupDb();
}, 30000);

beforeEach(() => {
  timekeeper.freeze('2020-08-02T08:42:24.934Z');
});

afterEach(async () => {
  jest.clearAllMocks();
  await resetDb();
  elasticsearchMock.clearAll();
}, 30000);

afterAll(async () => {
  await tearDownDb();
}, 30000);

describe('consumers/index-fill', () => {
  it('should consume indexing queue', () => {
    expect(consumer.queueName).toBe('fill-indexing');
  });

  it('should consume index-fill-traders jobs', () => {
    expect(consumer.jobName).toBe('index-fill');
  });

  it('should throw an error if fillId is invalid', async () => {
    await expect(
      consumer.fn(
        {
          data: {
            fillId: 'fubar',
          },
        },
        mockOptions,
      ),
    ).rejects.toThrow(new Error('Invalid fillId: fubar'));
  });

  it('should throw an error if fill cannot be found', async () => {
    await expect(
      consumer.fn(
        {
          data: {
            fillId: '5f7b709a5a345268dec8d425',
          },
        },
        mockOptions,
      ),
    ).rejects.toThrow(
      new Error('No fill found with the id: 5f7b709a5a345268dec8d425'),
    );
  });

  it('should index fill when found', async () => {
    const AddressMetadata = getModel('AddressMetadata');
    const Fill = getModel('Fill');

    await AddressMetadata.create({
      address: '0xf9757222770d93f0f71c30098d12d4754209f4d4',
      isContract: false,
    });

    await Fill.create({
      _id: '5f7b709a5a345268dec8d425',
      hasValue: true,
      immeasurable: false,
      status: 1,
      affiliateAddress: '0x86003b044f70dac0abc80ac8957305b6370893ed',
      assets: [
        {
          tokenResolved: true,
          amount: 1.41584999559191e21,
          tokenAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
          bridgeAddress: '0xc47b7094f378e54347e281aab170e8cca69d880a',
          bridgeData:
            '0x0000000000000000000000006b175474e89094c44da98b954eedeac495271d0f00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000047ed0262a0b688dcb836d254c6a2e96b6c48a9f50000000000000000000000000000000000000000000001075064e6a4615ec00000000000000000000000000000000000000000000000004cc0dda57efe13cfa0000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000d9e1ce17f2641f24ae83637ab66a2cca9c378b9f00000000000000000000000000000000000000000000000000000000000000030000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f984',
          actor: 0,
          price: {
            USD: 3.46495715102154,
          },
          value: {
            USD: 4905.859567,
          },
        },
        {
          tokenResolved: true,
          amount: 4.8572867e21,
          tokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
          actor: 1,
          price: {
            USD: 1.01,
          },
          value: {
            USD: 4905.859567,
          },
        },
      ],
      blockHash:
        '0x48d886d6a92fd8515963dab0ea79273b7aa0af3f5a7efeafd8bf1288f80b07b0',
      blockNumber: 10997543,
      date: new Date('2020-10-05T19:10:18.000Z'),
      eventId: '5f7b709a5a345268dec8d425',
      fees: [],
      feeRecipient: '0x1000000000000000000000000000000000000011',
      logIndex: 264,
      maker: '0xc47b7094f378e54347e281aab170e8cca69d880a',
      orderHash:
        '0x56b4f9485a5b3b21e66b2f4f91a0d54a1411ee4fd5e680772a2f7a35638d37d3',
      protocolFee: 5110000000000000.0,
      protocolVersion: 3,
      quoteDate: new Date('2020-10-05T19:10:35.000Z'),
      senderAddress: '0x0000008155f9986614d6fcba5388b624023bcb77',
      taker: '0xf9757222770d93f0f71c30098d12d4754209f4d4',
      transactionHash:
        '0xd1e01c31a2183107221ef094b3f7cbfedd13db0340df935464c1dddd2259a1ea',
      type: 0,
      attributions: [],
      relayerId: 35,
      conversions: {
        USD: {
          amount: 4905.859567,
          protocolFee: 1.7990777,
        },
      },
      pricingStatus: 0,
    });

    let indexingBody;
    elasticsearchMock.add(
      {
        method: 'PUT',
        path: '/fills/_doc/5f7b709a5a345268dec8d425',
      },
      ({ body }) => {
        indexingBody = body;

        return { status: 'ok' };
      },
    );

    await consumer.fn(
      { data: { fillId: '5f7b709a5a345268dec8d425' } },
      mockOptions,
    );

    expect(indexingBody).toEqual({
      affiliateAddress: '0x86003b044f70dac0abc80ac8957305b6370893ed',
      attributions: [],
      assets: [
        {
          bridgeAddress: '0xc47b7094f378e54347e281aab170e8cca69d880a',
          tokenAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        },
        { tokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f' },
      ],
      date: '2020-10-05T19:10:18.000Z',
      feeRecipient: '0x1000000000000000000000000000000000000011',
      fees: [],
      maker: '0xc47b7094f378e54347e281aab170e8cca69d880a',
      orderHash:
        '0x56b4f9485a5b3b21e66b2f4f91a0d54a1411ee4fd5e680772a2f7a35638d37d3',
      protocolFeeETH: 5110000000000000,
      protocolFeeUSD: 1.7990777,
      protocolVersion: 3,
      relayerId: 35,
      senderAddress: '0x0000008155f9986614d6fcba5388b624023bcb77',
      status: 1,
      taker: '0xf9757222770d93f0f71c30098d12d4754209f4d4',
      tradeCountContribution: 1,
      tradeVolume: 4905.859567,
      traders: [
        '0xc47b7094f378e54347e281aab170e8cca69d880a',
        '0xf9757222770d93f0f71c30098d12d4754209f4d4',
      ],
      transactionHash:
        '0xd1e01c31a2183107221ef094b3f7cbfedd13db0340df935464c1dddd2259a1ea',
      updatedAt: '2020-08-02T08:42:24.934Z',
      value: 4905.859567,
    });
  });

  it('should index transaction sender as taker when fill taker is contract address', async () => {
    const AddressMetadata = getModel('AddressMetadata');
    const Fill = getModel('Fill');
    const Transaction = getModel('Transaction');

    await AddressMetadata.create({
      address: '0xd4690a51044db77d91d7aa8f7a3a5ad5da331af0',
      isContract: true,
    });

    await Fill.create({
      _id: '5f7556972d14a83036966e50',
      hasValue: true,
      immeasurable: false,
      status: 1,
      assets: [
        {
          tokenResolved: true,
          amount: 3.6e17,
          tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          actor: 0,
          price: {
            USD: 362.75,
          },
          value: {
            USD: 130.59,
          },
        },
        {
          tokenResolved: true,
          amount: 1,
          tokenAddress: '0xd4690a51044db77d91d7aa8f7a3a5ad5da331af0',
          actor: 1,
          price: {
            USD: 130.59,
          },
          value: {
            USD: 130.59,
          },
        },
      ],
      blockHash:
        '0x564e844ba7f689212cee46dc58cd35f14307a3949b92688e1453bd591bdeeedb',
      blockNumber: 10967948,
      date: new Date('2020-10-01T04:06:04.000Z'),
      eventId: '5f7556972d14a83036966e50',
      fees: [
        {
          amount: {
            token: 9000000000000000.0,
            USD: 3.26475,
          },
          tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          traderType: 0,
        },
      ],
      feeRecipient: '0x0d056bb17ad4df5593b93a1efc29cb35ba4aa38d',
      logIndex: 188,
      maker: '0x74f90dbb59e9b8c4dfa0601cd303cb11e9fa4a78',
      orderHash:
        '0xe09c34f20581e253583105d33461dcc9a3e953d7420af9fceb740ce9ebc3a3d9',
      protocolFee: 4711000000000000.0,
      protocolVersion: 3,
      senderAddress: '0xd4690a51044db77d91d7aa8f7a3a5ad5da331af0',
      taker: '0xd4690a51044db77d91d7aa8f7a3a5ad5da331af0',
      transactionHash:
        '0x8222bab3a43ebacc13df998bacedc36abf43da9462726fbec28c778ce981395a',
      type: 0,
      attributions: [],
      relayerId: 28,
      conversions: {
        USD: {
          protocolFee: 1.70891525,
          amount: 130.59,
        },
      },
      pricingStatus: 0,
    });

    await Transaction.create({
      _id: '5f75569f6ee6272c398548bf',
      blockHash:
        '0x564e844ba7f689212cee46dc58cd35f14307a3949b92688e1453bd591bdeeedb',
      blockNumber: 10967948,
      data:
        '0xa2b18d9500000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000058000000000000000000000000000000000000000000000000000000000000005c09694a40200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000068000000000000000000000000000000000000000000000000000000000000006800000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000277ef970000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000074f90dbb59e9b8c4dfa0601cd303cb11e9fa4a7800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d056bb17ad4df5593b93a1efc29cb35ba4aa38d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004fefa17b72400000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000001ff973cafa80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005f7d97960000000000000000000000000000000000000000000000000000017468195e9e00000000000000000000000000000000000000000000000000000000000003c000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000003c0000000000000000000000000000000000000000000000000000000000000052000000000000000000000000000000000000000000000000000000000000001c4a7cb5fb7000000000000000000000000d4690a51044db77d91d7aa8f7a3a5ad5da331af0000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000e3a2a1f2146d86a604adc220b4967a898d7fe0700000000000000000000000009a379ef7218bcfd8913faa8b281ebc5a2e0bc0400000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000005e0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024f47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000421c4af7c6158183c2e4f2468535f94b64910780bae3be8dba8e86bece0b528db1c941d0f12f3c55184cc6a3484484e9d2ab8a82f1290fb864f3c6972eaf5f9311a4020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      date: new Date('2020-10-01T04:06:04.000Z'),
      from: '0x819dbfd8788e44917de930252dc1474a066ea2b7',
      gasLimit: 567385,
      gasPrice: '67300000000',
      gasUsed: 366120,
      hash:
        '0x8222bab3a43ebacc13df998bacedc36abf43da9462726fbec28c778ce981395a',
      index: 74,
      nonce: '1477',
      to: '0xd4690a51044db77d91d7aa8f7a3a5ad5da331af0',
      value: '10095000000000000',
    });

    let indexingBody;
    elasticsearchMock.add(
      {
        method: 'PUT',
        path: '/fills/_doc/5f7556972d14a83036966e50',
      },
      ({ body }) => {
        indexingBody = body;

        return { status: 'ok' };
      },
    );

    await consumer.fn(
      { data: { fillId: '5f7556972d14a83036966e50' } },
      mockOptions,
    );

    expect(indexingBody.taker).toBe(
      '0x819dbfd8788e44917de930252dc1474a066ea2b7',
    );
  });
});
