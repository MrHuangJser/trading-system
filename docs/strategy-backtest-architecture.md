# Strategy Backtest Platform Architecture & Requirements

## 1. Overview
This document captures the target architecture, functional requirements, and implementation guidelines for the Bun + TypeScript + React + Nx powered strategy backtest platform. The platform ingests one-second OHLCV CSV market data, aggregates it into user-defined candle intervals, executes pluggable strategies against the aggregated data using a high-fidelity matching engine, and visualizes results with KLineCharts.

## 2. Goals & Non-Goals
- **Goals**
  - Provide a single-user backtesting environment with CSV upload & replacement workflow.
  - Support time-frame aggregation (1m, 5m, 15m, 30m, 1h) from 1s OHLCV data.
  - Enable strategy plugins written in TypeScript via a shared SDK and worker isolation.
  - Simulate market, limit, and stop orders with second-level precision and record full trade history.
  - Deliver report metrics (PnL, win rate, average R/R, max drawdown, etc.) and per-trade detail for visualization.
  - Render aggregated candles and trade annotations on the frontend using React + KLineCharts.
- **Non-Goals**
  - Multi-user access control, tenancy, or real-time market data streaming.
  - Multi-language strategy support (TypeScript only).
  - Multiple concurrent datasets (CSV uploads are destructive replaces).
  - Deployment automation beyond local development.

## 3. Primary User Journeys
1. Upload a new CSV file (e.g., `data/MESZ3-OHLC1s-20231215.csv`) to reset the dataset.
2. Configure a backtest (choose strategy, interval, date range, params) and run it.
3. Monitor progress via WebSocket events and view live candle/trade overlay.
4. Review completed backtest results (charts, orders/trades tables, summary metrics) and download report artifacts.
5. Browse historical run history and reopen reports.

## 4. Technology Stack
- **Runtime & Tooling**: Bun (runtime, bundler, test runner), Nx (monorepo orchestration via `bunx nx`).
- **Backend Framework**: NestJS atop Bun (`@nestjs/platform-fastify`, `Bun.serve()` bootstrap).
- **Frontend**: React 18, Ant Design, Tailwind CSS, KLineCharts v9.
- **Storage**: SQLite (via `bun:sqlite`) for metadata & results; filesystem for raw CSV, aggregated cache, and report exports.
- **Messaging**: Bun Workers for strategy isolation; WebSocket support through Bun/Nest gateway.
- **Testing**: `bun test`, React Testing Library, Playwright (integration), Nest testing utilities.

## 5. Monorepo Layout (Nx Workspace)
```
apps/
  api/              # Nest entrypoint (Bun bootstrap)
  frontend/         # React + Antd + Tailwind + KLineCharts
libs/
  domain/
    market-data/    # CSV parsing, aggregation, candles
    exchange/       # Matching engine, order lifecycle
    portfolio/      # Positions, PnL, stats
    reporting/      # Report builders, exporters
    strategy-sdk/   # Strategy lifecycle contracts, helpers
  infra/
    storage/        # SQLite access, file utilities
    messaging/      # Worker orchestration, event bus
    config/         # Shared configuration & env handling
  shared/
    types/          # DTOs, enums, schema typings
    utils/          # Cross-cutting helpers
tools/
  executors/        # Custom Nx executors for Bun commands
storage/
  raw/              # Uploaded CSV (single active file)
  cache/            # Aggregated candle caches per interval
  reports/          # JSON/CSV run outputs
```

## 6. Data Lifecycle
1. **Upload & Reset**
   - POST `/api/dataset/upload` replaces existing dataset.
   - Old raw file, aggregate cache, SQLite tables (`aggregate_kline`, `orders`, `positions`, `backtest_runs`) are truncated.
2. **Validation & Standardization**
   - Stream parse CSV (timestamp, open, high, low, close, volume). No timezone conversion; timestamps are expected in Unix milliseconds.
   - Sort, dedupe, and drop malformed rows during ingestion.
3. **Storage**
   - Persist validated rows to `storage/raw/raw_ticks.csv` (optional Parquet in future).
   - Update `dataset_info` table with filename, size, time range, upload timestamp.
4. **Aggregation**
   - On-demand generator produces requested candle interval (1m–1h) using sliding windows over raw ticks.
   - Aggregated results cached in SQLite `aggregate_kline` keyed by interval; invalidated on new upload.
5. **Backtest Execution**
   - Scheduler streams aggregated candles and second-level fills to strategy worker.
   - Matching engine records orders, trades, equity updates; persisted to SQLite and report JSON.
6. **Reporting & Visualisation**
   - JSON report written to `storage/reports/<runId>.json`, CSV export to `<runId>.csv`.
   - Frontend fetches data for charts, trade tables, and summary metrics.

## 7. Backend Architecture (Nest on Bun)
- **Bootstrap**: `main.ts` uses `Bun.serve()` to host Fastify adapter running Nest app; enables WebSocket upgrade via Bun.
- **Modules**
  - `DatasetModule`: upload controller, dataset service (validation, storage reset).
  - `BacktestModule`: orchestrator service, run repository, reporting service.
  - `StrategyModule`: registry of available strategies, worker manager.
  - `WsGatewayModule`: WebSocket gateway for progress and event streaming.
  - `SharedModule`: configuration, logging, database providers.
- **Services**
  - `AggregationService`: fetches/caches aggregated candles, exposes streaming iterators.
  - `BacktestRunner`: coordinates strategy worker, matching engine, portfolio tracker.
  - `ReportService`: compiles metrics, persists JSON/CSV, exposes retrieval APIs.
- **Workers**
  - Each strategy run spawns a Bun Worker executing plugin code with isolated context.
  - `StrategyContext` exposes `onInit`, `onCandle`, `onOrderFilled`, `onClose` hooks plus utilities (`context.data`, `context.orders`).
- **Error Handling**
  - Input validation with class-validator/class-transformer.
  - Upload issues or strategy failures reported via WebSocket `error` event and HTTP status codes.

## 8. Strategy Plugin Model
- Strategies live under `strategies/<strategy-name>/strategy.ts` and register via `registerStrategy` helper.
- Metadata file (`strategy.json`) declares name, description, default params, required interval(s).
- Platform responsibilities:
  - Provide aggregated candles adhering to requested interval.
  - Supply access to historical windows and current state via `context.data.getHistory()`.
  - Accept order submissions and stream order/trade events back to the strategy.
- Strategy authors implement all indicators internally—platform does not precompute indicators.
- Optional worker lifecycle hooks for warm-up, teardown, and custom logging.

## 9. Matching & Portfolio Management
- **Order Types**: market, limit, stop (converted to market/limit when triggered by second-level data).
- **Execution Logic**
  - For each aggregated candle, matching engine replays constituent second-level ticks to evaluate triggers.
  - Supports partial fills, slippage models, fees, and order aging/expiry.
- **Portfolio Tracking**
  - Maintains per-strategy position state (size, average price, unrealized PnL, cash balance).
  - Emits events (`orderAccepted`, `trade`, `positionUpdate`, `equity`) consumed by reporting.
- **Risk Controls** (extensible)
  - Optional modules for leverage limits, daily loss caps, or margin calls.

## 10. Storage Design
- **Filesystem**
  - `storage/raw/raw_ticks.csv`: single active dataset; overwritten on upload.
  - `storage/cache/<interval>.json`: optional precomputed candle snapshots.
  - `storage/reports/<runId>.json|csv`: persisted backtest outputs.
- **SQLite (bun:sqlite)**
  - `dataset_info(id INTEGER PRIMARY KEY, filename TEXT, size_bytes INTEGER, start_ts INTEGER, end_ts INTEGER, uploaded_at TEXT)`
  - `aggregate_kline(id INTEGER PRIMARY KEY, interval TEXT, ts INTEGER, open REAL, high REAL, low REAL, close REAL, volume REAL)`
  - `backtest_runs(id TEXT PRIMARY KEY, strategy_id TEXT, interval TEXT, params_json TEXT, created_at TEXT, status TEXT, summary_json TEXT)`
  - `orders(id TEXT PRIMARY KEY, run_id TEXT, ts INTEGER, side TEXT, type TEXT, price REAL, size REAL, status TEXT)`
  - `trades(id TEXT PRIMARY KEY, run_id TEXT, entry_order_id TEXT, exit_order_id TEXT, entry_ts INTEGER, exit_ts INTEGER, entry_price REAL, exit_price REAL, size REAL, pnl REAL, rr REAL, drawdown REAL)`
  - `equity_curve(id INTEGER PRIMARY KEY, run_id TEXT, ts INTEGER, equity REAL)`
  - Foreign keys link `orders`, `trades`, `equity_curve` to `backtest_runs`.

## 11. HTTP API Contract (v1)
- `POST /api/dataset/upload` — multipart CSV upload. Response: `{ datasetInfo }`.
- `GET /api/dataset/info` — returns current dataset metadata.
- `POST /api/backtests` — body `{ strategyId, interval, dateRange?, params }`; returns `{ runId }`.
- `GET /api/backtests` — list runs with summary metrics.
- `GET /api/backtests/:runId` — fetches stored report JSON.
- `GET /api/backtests/:runId/download` — downloads CSV export (optional).
- `GET /api/strategies` — enumerate registered strategies & default params.

## 12. WebSocket Events
Namespace: `/backtests` (per-run channel `ws://.../backtests/{runId}`)
- `progress` `{ runId, stage, percent }`
- `candle` `{ runId, interval, candle }`
- `trade` `{ runId, trade }`
- `order` `{ runId, order }`
- `equity` `{ runId, point }`
- `completed` `{ runId, summary }`
- `error` `{ runId, message, details? }`

## 13. Frontend Architecture
- **Bundling**: Served via Bun bundler; HTML entry imports `frontend.tsx`.
- **State Management**: Zustand (or Redux Toolkit) module within `libs/ui/state` to track dataset info, active run, trades, candles.
- **Views**
  - Upload view: Antd Upload component, shows latest dataset metadata.
  - Backtest config: Form for strategy, interval, params, date range.
  - Run dashboard: KLineCharts main panel, trade markers, Antd tables for trades/orders, stats cards (PnL, win rate, avg R/R, max drawdown).
  - History view: list of past runs with ability to reopen reports.
- **Styling**: Tailwind for layout/theme overrides, Antd components for controls and tables.
- **WebSocket Integration**: Custom hook wraps native WebSocket; dispatches events into state store for real-time UI updates.

## 14. Testing & Quality Assurance
- **Unit Tests** (`bun test`)
  - CSV parsing & validation, aggregation correctness, matching edge cases, portfolio calculations.
- **Integration Tests**
  - Nest testing module spins API in-memory to validate upload/backtest endpoints (using sample CSV).
  - Strategy runner scenario tests (mock strategy verifying order flows).
- **Frontend Tests**
  - React Testing Library for forms and state transitions.
  - Playwright e2e: start API (`bunx nx serve api`) & frontend, execute upload + backtest happy path.
- **Static Analysis**: ESLint, TypeScript project references across Nx workspace.

## 15. Operations & Tooling
- **Setup**: `bun install`
- **Serve API**: `bunx nx serve api`
- **Serve Frontend**: `bunx nx serve frontend`
- **Run Tests**: `bunx nx test <project>` or `bun test` at package level.
- **Generate Reports**: automatic during backtest; manual download via API/Frontend.
- **Configuration**: `.env` auto-loaded by Bun (no `dotenv`). Include DB path, storage roots, default intervals.

## 16. Performance & Scalability Notes
- Single-user workload with ~300 MB CSV (~1 quarter of 1s data). Streaming ingestion prevents excessive memory usage.
- Aggregation caches avoid recomputation across runs; invalidated on upload.
- Worker-based strategy execution prevents blocking the Nest event loop.
- SQLite with WAL mode provides sufficient throughput; consider vacuuming after large deletions.

## 17. Future Enhancements (Out of Scope)
- Additional storage backends (DuckDB/Parquet) for faster analytical queries.
- Strategy marketplace UI & parameter optimization sweeps.
- Multi-dataset management, concurrent backtests, distributed execution.
- Advanced risk modules and performance dashboards.

## Appendix A — Backtest Report JSON Schema
See shared contract for serialization between backend and frontend.
```json
{
  "$id": "BacktestReport",
  "type": "object",
  "required": ["runId", "dataset", "strategy", "summary", "trades", "orders", "equityCurve"],
  "properties": {
    "runId": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "dataset": {
      "type": "object",
      "properties": {
        "filename": { "type": "string" },
        "interval": { "type": "string" },
        "bars": { "type": "integer" },
        "startTs": { "type": "integer" },
        "endTs": { "type": "integer" }
      }
    },
    "strategy": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "params": { "type": "object" }
      }
    },
    "summary": {
      "type": "object",
      "required": ["grossPnl", "netPnl", "winRate", "avgRR", "maxDrawdown", "tradeCount"],
      "properties": {
        "grossPnl": { "type": "number" },
        "netPnl": { "type": "number" },
        "winRate": { "type": "number" },
        "avgRR": { "type": "number" },
        "maxDrawdown": { "type": "number" },
        "tradeCount": { "type": "integer" },
        "largestWin": { "type": "number" },
        "largestLoss": { "type": "number" },
        "avgHoldDurationSec": { "type": "number" }
      }
    },
    "orders": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["orderId", "ts", "side", "type", "price", "size", "status"],
        "properties": {
          "orderId": { "type": "string" },
          "parentId": { "type": ["string", "null"] },
          "ts": { "type": "integer" },
          "side": { "enum": ["buy", "sell"] },
          "type": { "enum": ["market", "limit", "stop"] },
          "price": { "type": "number" },
          "size": { "type": "number" },
          "status": { "enum": ["accepted", "filled", "canceled", "rejected", "expired"] }
        }
      }
    },
    "trades": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["tradeId", "entryOrderId", "exitOrderId", "entryTs", "exitTs", "entryPrice", "exitPrice", "size", "pnl", "rr"],
        "properties": {
          "tradeId": { "type": "string" },
          "entryOrderId": { "type": "string" },
          "exitOrderId": { "type": "string" },
          "entryTs": { "type": "integer" },
          "exitTs": { "type": "integer" },
          "entryPrice": { "type": "number" },
          "exitPrice": { "type": "number" },
          "size": { "type": "number" },
          "pnl": { "type": "number" },
          "rr": { "type": "number" },
          "drawdown": { "type": "number" },
          "notes": { "type": ["string", "null"] }
        }
      }
    },
    "equityCurve": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["ts", "equity"],
        "properties": {
          "ts": { "type": "integer" },
          "equity": { "type": "number" }
        }
      }
    }
  }
}
```
