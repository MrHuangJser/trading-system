# Mother Bar Strategy 服务

本项目提供 Mother Bar 策略的回测与数据管理服务，包含数据集上传、K 线聚合、策略回测以及基础的 REST API。

## 快速开始

```bash
bun install
bun run dev   # 默认在 http://localhost:3000 提供接口
```

生产部署时请确保 Bun 版本与 `bun.lock` 中一致，并使用如 `bun run start` 等命令以生产模式启动。

## 数据上传与回测流程概览

1. 客户端通过 `POST /api/data/upload` 上传秒级 CSV 数据，服务端会将临时文件保存至 `storage/uploads` 并完成字段校验。
2. 校验通过后文件会被移动到 `storage/datasets/<uuid>.csv`，同时在 `storage/data.sqlite` 中写入元数据记录。
3. 设为激活的数据集会覆盖默认配置中的 `dataFile`，后续的蜡烛聚合、回测都会优先读取该数据集。
4. `POST /api/backtest` 根据请求参数与激活数据集执行 Mother Bar 策略回测，可通过 `timeframe` 指定目标周期。
5. `GET /api/candles` 会返回缓存后的聚合蜡烛数据，供前端图表或回测结果展示。

### 存储结构

```
storage/
  uploads/        # 临时上传目录，处理完成后会清空
  datasets/       # 永久存储的原始 CSV，命名为数据集 UUID
  data.sqlite     # 数据集元信息，使用 bun:sqlite 管理
```

SQLite 表 `datasets` 结构：

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 数据集 UUID |
| filename | TEXT | 存储在 `storage/datasets` 下的文件名 |
| originalName | TEXT | 上传时的原始文件名 |
| uploadedAt | TEXT | ISO 时间戳 |
| rows | INTEGER | 数据行数（不含表头） |
| secondsStart | TEXT | 第一条秒级数据时间 |
| secondsEnd | TEXT | 最后一条秒级数据时间 |
| note | TEXT | 上传备注 |
| isActive | INTEGER | 是否为当前激活数据集 |

秒级数据与各周期蜡烛会被缓存在内存中，以加速重复回测。

## API 端点示例

### 上传数据集：`POST /api/data/upload`

```
curl -X POST http://localhost:3000/api/data/upload \
  -F "file=@/path/to/data.csv" \
  -F "note=2023-12 RTH" \
  -F "activate=true"
```

成功时返回的 JSON（部分字段）：

```json
{
  "id": "a3e8...",
  "originalName": "data.csv",
  "rows": 86400,
  "secondsStart": "2023-12-01T14:30:00Z",
  "secondsEnd": "2023-12-01T21:00:00Z",
  "isActive": true,
  "note": "2023-12 RTH"
}
```

> **前端注意**：新增的 `rows`、`secondsStart`、`secondsEnd` 字段可直接用于展示数据概况。

### 列举数据集：`GET /api/data`

```
curl http://localhost:3000/api/data
```

返回一个数组，元素与上传接口返回结构一致，`isActive=true` 表示当前生效的数据集。

### 执行回测：`POST /api/backtest`

```
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "a3e8...",
    "timeframe": "5m",
    "baseQuantity": 2,
    "enableLongEntry": true,
    "enableShortEntry": false
  }'
```

- `datasetId`：使用激活数据集以外的指定数据集。
- `dataFile`：可选，绝对或相对路径，二选一。
- `timeframe`：可选，覆盖默认周期，支持 `1m`, `5m`, `15m`, `30m`, `1h` 等在 `SUPPORTED_TIMEFRAMES` 中声明的值。

响应中包含：

```json
{
  "metadata": { "timeframe": "5m", ... },
  "summary": { "grossProfit": 1200, "trades": [/* ... */] },
  "candles": [/* 5 分钟蜡烛 */],
  "trades": [/* 与 summary.trades 相同 */]
}
```

### 获取聚合蜡烛：`GET /api/candles`

```
curl "http://localhost:3000/api/candles?page=1&pageSize=500&timeframe=15m"
```

返回分页结构：

```json
{
  "meta": {
    "page": 1,
    "pageSize": 500,
    "total": 3200,
    "totalPages": 7
  },
  "data": [/* CandleExportRow 数组 */]
}
```

## 时间框架配置

- 默认周期来自 `resolveConfig`，读取顺序：CLI 参数 `--timeframe` → 环境变量 `TIMEFRAME` → 默认 `1m`。
- 激活数据集会覆盖配置中的 `dataFile` 路径，但不会修改默认 `timeframe`。
- 回测请求体中的 `timeframe` 字段可临时覆盖默认值；若省略则使用配置值。
- `GET /api/candles` 的 `timeframe` 查询参数同样支持所有 `SUPPORTED_TIMEFRAMES`。

## 部署注意事项

- **文件权限**：确保运行用户对 `storage/`, `storage/uploads/`, `storage/datasets/` 具有读写权限，推荐在部署前手动创建目录并赋予最小权限。
- **SQLite 备份**：`storage/data.sqlite` 可通过 `sqlite3 storage/data.sqlite ".backup 'backup/data-$(date +%F).sqlite'"` 或文件系统快照定期备份；备份时最好在低流量时段执行，避免长时间锁表。
- **内存缓存限制**：服务会把当前激活数据集的全部秒级数据及衍生的多周期蜡烛缓存在内存中，大文件会迅速占满内存。部署时应监控 RSS，必要时通过拆分数据集、扩容或定期重启来释放缓存。

## 前端联调提示

- 数据集列表与上传响应新增 `rows`、`secondsStart`、`secondsEnd` 字段；若 UI 依赖旧字段需相应更新。
- 回测响应保证 `metadata.timeframe` 与请求保持一致，并显式返回 `candles`、`trades` 两个数组，便于图表与明细复用；前端应避免只读取旧的 `summary.trades`。
- 当切换激活数据集后，后端会清空缓存，前端可能需要重新拉取蜡烛数据以保持一致。
