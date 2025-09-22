# MotherBar策略重写设计文档

## 概述

本设计文档描述了基于 mother-bar-rule.md 规则文档对现有 MB.pine 策略的完整重写。现有策略存在多个与规则文档不一致的地方，需要进行全面的架构重新设计以确保完全符合规范要求。

### 项目目标
- 完全按照 mother-bar-rule.md 规定的规则重新实现 MotherBar 策略
- 修正现有实现中的逻辑错误和规则偏差
- 建立清晰的状态管理机制
- 实现完整的交易生命周期管理
- 严格限制仅在RTH交易时段执行策略，避免跨时段跳空风险
- 每个RTH开始时重新寻找MB，忽略之前的MB状态
- 建立持仓期间的新MB记录机制，避免冲突交易

## 核心问题分析

### 现有实现的主要问题

| 问题类别 | 现有实现 | 规则要求 | 影响 |
|---------|---------|---------|-----|
| MB失效条件 | 使用61.8%阈值 | 200%和-100%位置 | 错误的MB生命周期管理 |
| 交易方向限制 | 基于阳线/阴线限制 | 无限制，同时挂买卖单 | 交易机会丢失 |
| 止损设置 | -100%和200% | -200%或300% | 风险控制不当 |
| 加仓机制 | 无实现 | 完整的加仓和止盈调整 | 错失盈利优化 |
| 交易次数限制 | 无限制 | 每个MB最多2笔交易 | 过度交易风险 |
| 交易时段控制 | 无限制 | 仅RTH时段交易 | 跨时段跳空风险暴露 |
| RTH重置机制 | 无处理 | RTH开始时重新寻找MB | 跨时段状态混乱 |
| 持仓期新MB | 无处理 | 记录但不交易 | 冲突交易风险 |

## 架构设计

### 状态管理架构

```mermaid
stateDiagram-v2
    [*] --> NoMB: 初始状态
    NoMB --> RTHStart: RTH时段开始
    RTHStart --> ClearPrevious: 清除之前所有MB状态
    ClearPrevious --> SearchMB: 重新寻找MB
    SearchMB --> ActiveMB: RTH内检测到内包K线
    SearchMB --> SearchMB: 继续寻找
    ActiveMB --> NoMB: MB失效(200%/-100%)
    ActiveMB --> Trading: 挂单交易(无持仓)
    ActiveMB --> PendingMB: 记录新MB(有持仓)
    Trading --> Position: 订单成交
    Position --> AddPosition: 加仓条件满足
    AddPosition --> Position: 加仓完成
    Position --> TakeProfit: 止盈触发
    TakeProfit --> CheckPendingMB: 检查是否有待处理MB
    CheckPendingMB --> Trading: 使用最新MB重新挂单
    CheckPendingMB --> SearchMB: 无待处理MB，重新寻找
    Position --> StopLoss: 止损触发
    StopLoss --> CheckPendingMB: 检查是否有待处理MB
    PendingMB --> PendingMB: 更新为最新MB
    ActiveMB --> RTHEnd: RTH时段结束
    Position --> RTHEnd: RTH时段结束
    RTHEnd --> NoMB: 清除所有状态
```

### 核心组件架构

```mermaid
graph TB
    A[MotherBar检测器] --> B[价格水平计算器]
    B --> C[交易信号生成器]
    C --> D[订单管理器]
    D --> E[仓位管理器]
    E --> F[风险控制器]
    
    G[状态管理器] --> A
    G --> C
    G --> D
    G --> E
    
    H[配置管理器] --> B
    H --> F
    
    I[RTH时段检测器] --> C
    I --> D
    I --> G
    
    K[待处理MB管理器] --> G
    K --> C
```

## 数据模型设计

### MotherBar状态模型

| 字段名 | 类型 | 描述 | 初始值 |
|--------|------|------|--------|
| isActive | boolean | MB是否活跃 | false |
| highPrice | float | MB高点价格 | na |
| lowPrice | float | MB低点价格 | na |
| size | float | MB大小(高-低) | na |
| startBar | int | MB开始K线索引 | na |
| creationTime | int | MB创建时间 | na |
| isRTH | boolean | 是否在RTH时段创建 | false |

### 待处理MotherBar模型

| 字段名 | 类型 | 描述 | 初始值 |
|--------|------|------|--------|
| hasPendingMB | boolean | 是否有待处理MB | false |
| pendingHighPrice | float | 待处理MB高点 | na |
| pendingLowPrice | float | 待处理MB低点 | na |
| pendingSize | float | 待处理MB大小 | na |
| pendingStartBar | int | 待处理MB开始K线 | na |
| pendingCreationTime | int | 待处理MB创建时间 | na |

### 价格水平模型

| 水平位置 | 百分比 | 计算公式 | 用途 |
|----------|--------|----------|------|
| 300% | 300 | low + size * 3 | 空头止损 |
| 200% | 200 | low + size * 2 | MB失效边界 |
| 161.8% | 161.8 | low + size * 1.618 | 空头加仓后止盈 |
| 123% | 123 | low + size * 1.23 | 限价卖出区域 |
| 100% | 100 | high | MB高点/空头加仓 |
| 50% | 50 | low + size * 0.5 | 统一止盈位置 |
| 0% | 0 | low | MB低点 |
| -23% | -23 | low - size * 0.23 | 限价买入区域 |
| -61.8% | -61.8 | low - size * 0.618 | 多头加仓后止盈 |
| -100% | -100 | low - size | MB失效边界/多头加仓 |
| -200% | -200 | low - size * 2 | 多头止损 |

### 交易状态模型

| 字段名 | 类型 | 描述 |
|--------|------|------|
| tradeCount | int | 当前MB的交易次数 |
| hasLongPosition | boolean | 是否持有多头仓位 |
| hasShortPosition | boolean | 是否持有空头仓位 |
| longEntryPrice | float | 多头入场价格 |
| shortEntryPrice | float | 空头入场价格 |
| isAddedLong | boolean | 多头是否已加仓 |
| isAddedShort | boolean | 空头是否已加仓 |
| hasAnyPosition | boolean | 是否持有任何仓位 |

### RTH时段状态模型

| 字段名 | 类型 | 描述 |
|--------|------|------|
| isRTHActive | boolean | 当前是否为RTH时段 |
| isFirstRTHBar | boolean | 是否为RTH首根K线 |
| isLastRTHBar | boolean | 是否为RTH最后K线 |
| rthStartDetected | boolean | 是否检测到RTH开始 |
| prevRTHClose | float | 前一RTH时段收盘价 |
| rthSessionCount | int | RTH会话计数器 |

## 业务逻辑设计

### MotherBar检测逻辑

```mermaid
flowchart TD
    A[新K线完成] --> A1{是否RTH时段?}
    A1 -->|否| A2[忽略此K线，等待RTH]
    A1 -->|是| A3{是否RTH开始?}
    
    A3 -->|是| A4[清除所有之前MB状态]
    A3 -->|否| C{当前是否有活跃MB?}
    A4 --> C
    
    C -->|是| D{检查MB失效条件}
    C -->|否| E{检查内包条件}
    
    D -->|价格达到200%或-100%| F[MB失效，清理状态]
    D -->|未失效| G{是否有持仓?}
    
    G -->|有持仓| H{检查新内包条件}
    G -->|无持仓| I[保持当前MB状态]
    
    H -->|发现新内包| J[更新待处理MB]
    H -->|无新内包| I
    
    E -->|当前K线在前一K线内| K[创建新MB]
    E -->|不符合条件| L[继续寻找MB]
    
    F --> E
    K --> M[计算所有价格水平]
    M --> N[初始化交易状态]
```

### 交易执行逻辑

```mermaid
flowchart TD
    A[MB活跃且交易次数<2] --> A1{是否RTH时段?}
    A1 -->|否| A2[不执行交易]
    A1 -->|是| B{当前是否有持仓?}
    
    B -->|无持仓| C[同时挂买卖单]
    B -->|有持仓| D{检查加仓条件}
    
    C --> E[买单在-23%位置]
    C --> F[卖单在123%位置]
    E --> G[止盈50%，止损-200%]
    F --> H[止盈50%，止损300%]
    
    D -->|多头且价格达-100%| I[多头加仓]
    D -->|空头且价格达100%| J[空头加仓]
    D -->|不满足| K[维持当前状态]
    
    I --> L[调整止盈至-61.8%]
    J --> M[调整止盈至161.8%]
```

### 仓位管理逻辑

```mermaid
flowchart TD
    A[订单成交] --> B{成交类型}
    B -->|开仓| C[更新仓位状态]
    B -->|加仓| D[更新加仓状态]
    B -->|止盈| E[重置仓位状态]
    B -->|止损| F[重置仓位状态]
    
    C --> G[取消对向挂单]
    C --> H[增加交易计数]
    
    E --> E1{有待处理MB?}
    E1 -->|是| E2[激活最新待处理MB]
    E1 -->|否| I{交易次数<2?}
    
    E2 --> E3[重置交易计数]
    E3 --> E4[使用新MB重新挂单]
    
    F --> F1{有待处理MB?}
    F1 -->|是| E2
    F1 -->|否| F2[等待新MB]
    
    I -->|是| J{是否RTH时段?}
    I -->|否| K[等待MB失效]
    
    J -->|是| L[重新挂买卖单]
    J -->|否| K
```

## 关键算法设计

### 内包K线检测算法

**输入条件：**
- 当前K线的高低价
- 前一K线的高低价
- RTH时段状态
- 当前持仓状态

**检测规则：**
- 当前K线高价 ≤ 前一K线高价
- 当前K线低价 ≥ 前一K线低价
- 两个条件同时满足时形成内包关系

**处理逻辑：**
- RTH时段内 + 无持仓：创建活跃MB
- RTH时段内 + 有持仓：创建待处理MB
- 非RTH时段：仅记录但不创建MB

### 内包K线检测算法

**输入条件：**
- 当前K线的高低价
- 前一K线的高低价
- RTH时段状态
- 当前持仓状态

**检测规则：**
- 当前K线高价 ≤ 前一K线高价
- 当前K线低价 ≥ 前一K线低价
- 两个条件同时满足时形成内包关系
- 仅在RTH时段内处理内包检测

**处理逻辑：**
- RTH时段内 + 无持仓：创建活跃MB
- RTH时段内 + 有持仓：创建待处理MB
- 非RTH时段：忽略不处理

### RTH时段检测算法

**检测方法：**
- 使用session.isfirstbar_regular检测RTH开始
- 使用session.islastbar_regular检测RTH结束
- 维护RTH状态和会话计数

**RTH开始处理：**
- 清除所有之前的MB状态（活跃MB、待处理MB）
- 重置交易计数器
- 取消所有挂单
- 清除仓位状态标志
- 开始重新寻找新的MB

**RTH结束处理：**
- 保持现有仓位不变
- 停止新的MB检测
- 暂停所有新交易
- 保持现有止盈止损订单

**跳空风险避免：**
- 通过严格限制仅在RTH时段交易，自然避免跨时段跳空
- RTH开始时重置所有状态，消除隔夜跳空影响
- 非RTH时段完全停止策略活动

### 价格水平计算算法

**基础参数：**
- MB低点 (mbLow)
- MB高点 (mbHigh)  
- MB大小 (mbSize = mbHigh - mbLow)

**计算公式：**
- 正百分比位置：mbLow + mbSize * (percentage / 100)
- 负百分比位置：mbLow - mbSize * (abs(percentage) / 100)

**检测条件：**
- 价格突破200%水平：price ≥ mbLow + mbSize * 2
- 价格突破-100%水平：price ≤ mbLow - mbSize
- 考虑跳空影响：跳空导致的瞬间突破

**触发动作：**
- 清除当前活跃MB状态
- 取消所有挂单
- 重置交易计数器
- 保留待处理MB（如果存在）

### RTH时段检测算法

**检测方法：**
- 使用session.islastbar_regular检测RTH最后K线
- 使用session.isfirstbar_regular检测RTH第一K线
- 维护RTH状态标志

**状态管理：**
- RTH开始：重置日间状态，准备交易
- RTH结束：暂停新交易，保持现有仓位
- 非RTH时段：仅监控，不执行新交易

## 风险控制设计

### 交易次数控制

| 控制项 | 限制规则 | 实现方式 |
|--------|----------|----------|
| 每MB最大交易 | 2笔 | 交易计数器 |
| 重复挂单条件 | 止盈后允许 | 状态标志位 |
| 加仓限制 | 每方向最多1次 | 加仓标志位 |

### 仓位风险控制

| 风险类型 | 控制措施 | 实现方式 |
|----------|----------|----------|
| 单向仓位 | 同时只能持有一个方向 | 仓位状态检查 |
| 止损保护 | 固定止损水平 | 自动止损单 |
| 加仓风险 | 条件严格限制 | 价格水平验证 |

### 订单管理控制

| 管理项 | 控制规则 | 实现方式 |
|--------|----------|----------|
| 挂单取消 | 成交一方向后取消另一方向 | 自动取消逻辑 |
| 重复挂单 | 防止重复挂同类订单 | 状态检查 |
| 订单更新 | 加仓后更新止盈位置 | 动态调整机制 |

## 配置参数设计

### 交易参数配置

| 参数名 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| enableTrading | boolean | true | 是否启用交易 |
| initialCapital | float | 50000 | 初始资金 |
| defaultQty | int | 5 | 默认交易数量 |
| enableRTHOnly | boolean | true | 仅RTH时段交易 |
| rthSessionReset | boolean | true | RTH开始时重置状态 |

### 价格水平配置

| 参数名 | 类型 | 固定值 | 描述 |
|--------|------|--------|------|
| buyZonePercent | float | -23 | 买入区域百分比 |
| sellZonePercent | float | 123 | 卖出区域百分比 |
| takeProfitPercent | float | 50 | 止盈百分比 |
| longStopLossPercent | float | -200 | 多头止损百分比 |
| shortStopLossPercent | float | 300 | 空头止损百分比 |

### 加仓配置

| 参数名 | 类型 | 固定值 | 描述 |
|--------|------|--------|------|
| longAddPercent | float | -100 | 多头加仓百分比 |
| shortAddPercent | float | 100 | 空头加仓百分比 |
| longAddTpPercent | float | -61.8 | 多头加仓后止盈 |
| shortAddTpPercent | float | 161.8 | 空头加仓后止盈 |

## 测试策略

### 单元测试覆盖

| 测试模块 | 测试场景 | 预期结果 |
|----------|----------|----------|
| MB检测 | 内包K线识别 | 正确创建MB |
| 价格计算 | 各水平位置计算 | 精确的价格水平 |
| 失效检测 | 200%/-100%突破 | 及时失效并清理 |
| 交易逻辑 | 同时挂买卖单 | 正确的订单状态 |
| 加仓机制 | 条件触发加仓 | 正确的仓位调整 |
| RTH检测 | 时段边界识别 | 正确的时段状态 |
| RTH重置 | 状态清理机制 | 完全的状态重置 |
| 持仓期MB | 新MB记录机制 | 正确的待处理状态 |

### 集成测试场景

| 测试场景 | 测试步骤 | 验证点 |
|----------|----------|-------|
| 完整交易周期 | MB创建→挂单→成交→止盈 | 状态转换正确 |
| 加仓流程 | 开仓→价格到达加仓位→加仓→止盈调整 | 加仓逻辑正确 |
| MB失效处理 | MB活跃→价格突破→状态清理 | 清理彻底 |
| 交易次数限制 | 连续交易→达到上限→停止挂单 | 限制有效 |
| RTH边界测试 | RTH结束→新MB出现→仅记录不交易 | RTH控制有效 |
| RTH重置测试 | RTH开始→清理旧状态→重新寻找MB | 状态重置正确 |
| 持仓期新MB | 持仓中→新MB→记录待处理→止盈后激活 | 待处理机制有效 |
| 跨时段测试 | RTH结束→持仓过夜→RTH开始→状态重置 | 跨时段状态管理正确 |置 | 异常情况处理 |

### 性能测试要求

| 性能指标 | 目标值 | 测试方法 |
|----------|--------|----------|
| 计算延迟 | <1ms | 单K线处理时间 |
| 内存占用 | <10MB | 状态变量内存使用 |
| 历史回测 | 支持1年+ | 长期数据测试 |
| RTH检测性能 | <0.1ms | 时段判断延迟 |
| 状态切换延迟 | <0.2ms | 状态变量更新时间 |