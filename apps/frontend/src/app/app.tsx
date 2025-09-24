import { Radio, Spin } from 'antd';
import { useState } from 'react';
import useSWR from 'swr';
import { ChartPanel } from './components/ChartPanel';
import { DatasetSelector } from './components/DatasetSelector';

const HOST_URL = 'http://localhost:3000/api';

async function getCandleDataForDataset(
  datasetId: string,
  timeframe: Timeframe
) {
  const response = await fetch(
    `${HOST_URL}/data-manage/aggregate-dataset?filename=${datasetId}&timeframe=${timeframe}`
  );
  const result = (await response.json()) as { result: OhlcvRecord[] };
  return result.result.map((item) => ({
    timestamp: +new Date(item.datetime),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume,
  }));
}

export function App() {
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');

  const { data: candleData, isLoading } = useSWR(
    ['candle-data', selectedDataset, timeframe],
    () =>
      selectedDataset ? getCandleDataForDataset(selectedDataset, timeframe) : []
  );

  return (
    <Spin spinning={isLoading}>
      <div className="grid w-screen h-screen grid-cols-12 gap-2">
        <div className="col-span-3 p-2 flex flex-col gap-2">
          <DatasetSelector className="w-full" onSelect={setSelectedDataset} />
          <Radio.Group
            onChange={(e) => setTimeframe(e.target.value)}
            value={timeframe}
          >
            <Radio.Button value="1m">1m</Radio.Button>
            <Radio.Button value="5m">5m</Radio.Button>
            <Radio.Button value="15m">15m</Radio.Button>
            <Radio.Button value="30m">30m</Radio.Button>
            <Radio.Button value="1h">1h</Radio.Button>
          </Radio.Group>
        </div>
        <div className="col-span-9">
          <ChartPanel className="w-full h-[500px]" data={candleData ?? []} />
        </div>
      </div>
    </Spin>
  );
}

export default App;
