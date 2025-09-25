import fs from 'fs';
import os from 'os';
import path from 'path';

import { AggregationService } from './aggregation.service';
import { Timeframe } from '../types/ohlcv';

const SAMPLE_CSV = `datetime,open,high,low,close,volume
2023-09-15 08:30:00,100,100,100,100,10
2023-09-15 08:30:30,100.5,101,100.5,100.8,15
2023-09-15 08:30:59,100.8,101.5,100.7,101,20
2023-09-15 08:31:00,102,101.2,100.8,101.1,12
2023-09-15 08:31:59,101.1,101.5,100.9,101.3,18
2023-09-15 08:32:10,101.2,102,101,101.8,22
2023-09-15 08:34:59,101.8,103,101.5,102.9,30
2023-09-15 08:35:00,103,103.5,102.8,103.1,25
2023-09-15 08:35:59,103.1,103.7,102.9,103.5,28
`;

const createTempCsv = () => {
  const tmpFile = path.join(
    os.tmpdir(),
    `aggregation-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`
  );
  fs.writeFileSync(tmpFile, SAMPLE_CSV, 'utf8');
  return tmpFile;
};

describe('AggregationService', () => {
  let service: AggregationService;
  let csvPath: string;

  beforeEach(() => {
    service = new AggregationService();
    csvPath = createTempCsv();
  });

  afterEach(() => {
    if (csvPath && fs.existsSync(csvPath)) {
      fs.unlinkSync(csvPath);
    }
  });

  it('aggregates OHLCV data into 1 minute candles', async () => {
    const result = await service.aggregate(csvPath, Timeframe.ONE_MINUTE);

    expect(result).toEqual([
      {
        datetime: '2023-09-15 08:30:00',
        open: 100,
        high: 101.5,
        low: 100,
        close: 101,
        volume: 45,
      },
      {
        datetime: '2023-09-15 08:31:00',
        open: 102,
        high: 101.5,
        low: 100.8,
        close: 101.3,
        volume: 30,
      },
      {
        datetime: '2023-09-15 08:32:00',
        open: 101.2,
        high: 102,
        low: 101,
        close: 101.8,
        volume: 22,
      },
      {
        datetime: '2023-09-15 08:34:00',
        open: 101.8,
        high: 103,
        low: 101.5,
        close: 102.9,
        volume: 30,
      },
      {
        datetime: '2023-09-15 08:35:00',
        open: 103,
        high: 103.7,
        low: 102.8,
        close: 103.5,
        volume: 53,
      },
    ]);
  });

  it('aggregates OHLCV data into 5 minute candles', async () => {
    const result = await service.aggregate(csvPath, Timeframe.FIVE_MINUTES);

    expect(result).toEqual([
      {
        datetime: '2023-09-15 08:30:00',
        open: 100,
        high: 103,
        low: 100,
        close: 102.9,
        volume: 127,
      },
      {
        datetime: '2023-09-15 08:35:00',
        open: 103,
        high: 103.7,
        low: 102.8,
        close: 103.5,
        volume: 53,
      },
    ]);
  });
});
