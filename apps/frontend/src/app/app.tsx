import {
  Button,
  Card,
  Divider,
  Form,
  InputNumber,
  Input,
  message,
  Radio,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChartPanel, type TradeMarker } from './components/ChartPanel';
import { DatasetSelector } from './components/DatasetSelector';
import {
  BacktestResponse,
  ClosedTrade,
  StrategyListItem,
  StrategyParamSchema,
} from './types/backtest';

const HOST_URL = 'http://localhost:3000/api';

async function getCandleDataForDataset(
  datasetId: string,
  timeframe: Timeframe
) {
  const response = await fetch(
    `${HOST_URL}/data-manage/aggregate-dataset?filename=${datasetId}&timeframe=${timeframe}`
  );
  if (!response.ok) {
    throw new Error('获取K线数据失败');
  }
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

async function getStrategyList() {
  const response = await fetch(`${HOST_URL}/backtest/strategy-list`);
  if (!response.ok) {
    throw new Error('获取策略列表失败');
  }
  return (await response.json()) as StrategyListItem[];
}

async function runBacktest(payload: {
  datasetFileName: string;
  timeframe: Timeframe;
  strategyName: string;
  strategyParams: Record<string, unknown>;
}) {
  const response = await fetch(`${HOST_URL}/backtest/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const msg = await response.text();
    throw new Error(msg || '回测执行失败');
  }
  return (await response.json()) as BacktestResponse;
}

const numberFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const { Paragraph, Text } = Typography;

export function App() {
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [isRunning, setIsRunning] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResponse | null>(
    null
  );

  const { data: strategies } = useSWR('strategy-list', getStrategyList);
  const [selectedStrategy, setSelectedStrategy] = useState<string>();
  const [form] = Form.useForm<Record<string, number | string | boolean>>();

  const { data: candleData, isLoading: isCandleLoading } = useSWR(
    ['candle-data', selectedDataset, timeframe],
    () =>
      selectedDataset ? getCandleDataForDataset(selectedDataset, timeframe) : []
  );

  useEffect(() => {
    if (strategies && strategies.length > 0 && !selectedStrategy) {
      setSelectedStrategy(strategies[0].name);
    }
  }, [strategies, selectedStrategy]);

  useEffect(() => {
    setBacktestResult(null);
  }, [selectedDataset, timeframe]);

  const selectedStrategyMeta = useMemo(() => {
    if (!selectedStrategy || !strategies) {
      return undefined;
    }
    return strategies.find((item) => item.name === selectedStrategy);
  }, [selectedStrategy, strategies]);

  useEffect(() => {
    if (!selectedStrategyMeta) {
      form.resetFields();
      return;
    }
    const defaults = Object.entries(
      selectedStrategyMeta.paramsSchema?.properties ?? {}
    ).reduce<Record<string, number | string | boolean>>((acc, [key, schema]) => {
      if (schema.default !== undefined) {
        acc[key] = schema.default;
      }
      return acc;
    }, {});
    form.setFieldsValue(defaults);
  }, [form, selectedStrategyMeta]);

  const tradeMarkers: TradeMarker[] = useMemo(() => {
    if (!backtestResult?.closedTrades) {
      return [];
    }
    return backtestResult.closedTrades.map((trade, index) => ({
      id: `trade-${index}`,
      entryTimestamp: trade.entryTimestamp,
      entryPrice: trade.entryPrice,
      exitTimestamp: trade.exitTimestamp,
      exitPrice: trade.exitPrice,
      direction: trade.direction,
    }));
  }, [backtestResult]);

  const tradesTableColumns: ColumnsType<ClosedTrade> = useMemo(
    () => [
      {
        title: '方向',
        dataIndex: 'direction',
        key: 'direction',
        render: (value: ClosedTrade['direction']) => (
          <Tag color={value === 'BUY' ? 'green' : 'red'}>
            {value === 'BUY' ? '多' : '空'}
          </Tag>
        ),
      },
      {
        title: '入场时间',
        dataIndex: 'entryTimestamp',
        key: 'entryTimestamp',
        render: (value: number) => dateFormatter.format(value),
      },
      {
        title: '入场价',
        dataIndex: 'entryPrice',
        key: 'entryPrice',
        render: (value: number) => numberFormatter.format(value),
      },
      {
        title: '离场时间',
        dataIndex: 'exitTimestamp',
        key: 'exitTimestamp',
        render: (value: number) => dateFormatter.format(value),
      },
      {
        title: '离场价',
        dataIndex: 'exitPrice',
        key: 'exitPrice',
        render: (value: number) => numberFormatter.format(value),
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        key: 'quantity',
      },
      {
        title: '盈亏',
        dataIndex: 'pnl',
        key: 'pnl',
        render: (value: number) => (
          <span className={value >= 0 ? 'text-green-500' : 'text-red-500'}>
            {numberFormatter.format(value)}
          </span>
        ),
      },
    ],
    []
  );

  const handleRunBacktest = useCallback(async () => {
    if (!selectedDataset) {
      message.warning('请先选择数据集');
      return;
    }
    if (!selectedStrategy || !selectedStrategyMeta) {
      message.warning('请先选择策略');
      return;
    }
    if (!selectedStrategyMeta.supportedTimeframes.includes(timeframe)) {
      message.warning('当前策略不支持所选时间周期');
      return;
    }

    const params = selectedStrategyMeta.paramsSchema ? form.getFieldsValue() : {};

    setIsRunning(true);
    try {
      const result = await runBacktest({
        datasetFileName: selectedDataset,
        timeframe,
        strategyName: selectedStrategy,
        strategyParams: params,
      });
      setBacktestResult(result);
      message.success('回测完成');
    } catch (err) {
      const error = err as Error;
      message.error(error.message || '回测失败');
    } finally {
      setIsRunning(false);
    }
  }, [
    form,
    selectedDataset,
    selectedStrategy,
    selectedStrategyMeta,
    timeframe,
  ]);

  const renderParamInput = (
    key: string,
    schema: StrategyParamSchema,
    required: boolean
  ) => {
    const label = schema.description ?? key;
    if (schema.type === 'number') {
      return (
        <Form.Item
          key={key}
          label={label}
          name={key}
          rules={required ? [{ required: true, message: `请输入${label}` }] : []}
        >
          <InputNumber className="w-full" />
        </Form.Item>
      );
    }
    if (schema.type === 'boolean') {
      return (
        <Form.Item
          key={key}
          label={label}
          name={key}
        >
          <Radio.Group>
            <Radio value={true}>是</Radio>
            <Radio value={false}>否</Radio>
          </Radio.Group>
        </Form.Item>
      );
    }
    if (schema.type === 'string') {
      return (
        <Form.Item
          key={key}
          label={label}
          name={key}
          rules={required ? [{ required: true, message: `请输入${label}` }] : []}
        >
          <Input className="w-full" />
        </Form.Item>
      );
    }
    return (
      <Form.Item
        key={key}
        label={label}
        name={key}
        rules={required ? [{ required: true, message: `请输入${label}` }] : []}
      >
        <InputNumber className="w-full" />
      </Form.Item>
    );
  };

  const paramSchemaEntries = Object.entries(
    selectedStrategyMeta?.paramsSchema?.properties ?? {}
  );
  const requiredParams = selectedStrategyMeta?.paramsSchema?.required ?? [];

  const summary = backtestResult?.summary;
  const winRate = useMemo(() => {
    if (!summary || summary.totalTrades === 0) {
      return 0;
    }
    return (summary.winTrades / summary.totalTrades) * 100;
  }, [summary]);

  return (
    <Spin spinning={isCandleLoading || isRunning} tip="处理中...">
      <div className="grid w-screen h-screen grid-cols-12 gap-4 p-4 overflow-hidden">
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          <Card title="数据集与时间周期" size="small">
            <Space direction="vertical" size="middle" className="w-full">
              <DatasetSelector
                className="w-full"
                onSelect={(value) => {
                  setSelectedDataset(value);
                }}
              />
              <Radio.Group
                onChange={(e) => setTimeframe(e.target.value)}
                value={timeframe}
                className="w-full flex flex-col gap-2"
              >
                <Radio.Button value="1m">1m</Radio.Button>
                <Radio.Button value="5m">5m</Radio.Button>
                <Radio.Button value="15m">15m</Radio.Button>
                <Radio.Button value="30m">30m</Radio.Button>
                <Radio.Button value="1h">1h</Radio.Button>
              </Radio.Group>
            </Space>
          </Card>

          <Card title="策略设置" size="small">
            <Form form={form} layout="vertical">
              <Form.Item label="选择策略" required>
                <Select
                  placeholder="请选择策略"
                  value={selectedStrategy}
                  onChange={(value) => setSelectedStrategy(value)}
                >
                  {strategies?.map((item) => (
                    <Select.Option key={item.name} value={item.name}>
                      {item.description || item.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedStrategyMeta && (
                <Paragraph type="secondary">
                  支持周期：
                  {selectedStrategyMeta.supportedTimeframes.join(' / ')}
                </Paragraph>
              )}

              {paramSchemaEntries.length > 0 && (
                <Divider orientation="left">参数</Divider>
              )}

              {paramSchemaEntries.map(([key, schema]) =>
                renderParamInput(key, schema, requiredParams.includes(key))
              )}

              <Button
                type="primary"
                className="w-full"
                onClick={handleRunBacktest}
                disabled={!selectedDataset || !selectedStrategy}
              >
                运行回测
              </Button>
            </Form>
          </Card>

          {backtestResult && (
            <Card title="策略统计" size="small">
              {summary ? (
                <Space size="large">
                  <Statistic title="总交易" value={summary.totalTrades} />
                  <Statistic
                    title="总盈亏"
                    value={numberFormatter.format(summary.totalPnl)}
                  />
                  <Statistic
                    title="胜率"
                    value={numberFormatter.format(winRate)}
                    suffix="%"
                  />
                </Space>
              ) : (
                <Text type="secondary">暂无统计数据</Text>
              )}
            </Card>
          )}
        </div>

        <div className="col-span-9 flex flex-col gap-4 overflow-hidden">
          <Card
            title="K线图"
            className="flex-1 flex flex-col"
            bodyStyle={{ height: '100%', padding: 0 }}
          >
            <ChartPanel
              className="w-full h-full"
              data={candleData ?? []}
              markers={tradeMarkers}
            />
          </Card>

          <Card
            title="交易列表"
            className="flex-1 flex flex-col"
            bodyStyle={{ height: '100%', padding: 0 }}
          >
            <Table<ClosedTrade>
              dataSource={backtestResult?.closedTrades ?? []}
              columns={tradesTableColumns}
              size="small"
              pagination={{ pageSize: 8 }}
              rowKey={(record, index) => `${record.entryTimestamp}-${index}`}
            />
          </Card>
        </div>
      </div>
    </Spin>
  );
}

export default App;
