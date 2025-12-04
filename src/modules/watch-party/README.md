# Watch Party Module - Buffered Writes Architecture

This document outlines the architecture of the buffered write system for the Watch Party module. The primary goal of this system is to reduce database load during high-traffic watch party events by batching real-time data (logs, chats, likes) before persisting it.

## 1. Architecture Overview

Instead of writing to the database on every real-time event, events are now pushed into an in-memory buffer specific to each active watch party. This buffer is managed by a `WatchPartyRoom`. These instances are created when a party goes `ONGOING` and destroyed when it becomes `FINISHED`.

Data is flushed from the buffer to the PostgreSQL database in two scenarios:
1.  **Periodic Flush**: A cron job runs every 10 minutes to flush all "dirty" (modified) buffers to the database.
2.  **Final Flush**: When a watch party ends (or the server shuts down), a final flush is performed to ensure no data is lost.

## 2. Core Components

-   `WatchPartyRoom` (`watch-party-instance.ts`)
    -   A class representing the in-memory buffer for a single watch party.
    -   Holds arrays/sets for logs, chats, likes, and viewer counts.
    -   Contains the `flush()` logic to persist its buffered data via the `WatchPartyPersistenceService`.

-   `WatchPartyRoomManager` (`watch-party-instance.manager.ts`)
    -   A singleton service that manages the entire lifecycle of all `WatchPartyRoom` objects.
    -   APIs: `createInstance`, `getInstance`, `closeInstance`.
    -   Handles periodic flushing via a `@Cron` job.
    -   Handles graceful shutdown flushing via the `onModuleDestroy` lifecycle hook.

-   `WatchPartyPersistenceService` (`watch-party-persistence.service.ts`)
    -   A dedicated service responsible for all database write operations for the buffering system.
    -   Uses transactions and bulk `INSERT ... ON CONFLICT DO NOTHING` queries (`orIgnore()` in TypeORM QueryBuilder) to efficiently and safely write batches of data. This ensures idempotency, meaning the same event can be sent multiple times without creating duplicate records.

-   `WatchPartyGateway` (`watch-party.gateway.ts`)
    -   The Socket.IO gateway that handles all real-time client communication.
    -   It is now decoupled from direct database writes. Instead, it finds the appropriate `WatchPartyRoom` and calls its `append...` methods (e.g., `appendChatMessage`, `appendLike`).

-   `WatchPartyService` (`watch-party.service.ts`)
    -   The main business logic service.
    -   The `updatePartyStatus` method is now responsible for triggering the creation and destruction of `WatchPartyRoom` objects as parties start and end.

## 3. Event Flow

1.  A `WatchPartyScheduler` runs periodically, calling `WatchPartyService.updatePartyStatus`.
2.  When a party's `start_time` is reached, its status becomes `ONGOING`. `WatchPartyService` calls `instanceManager.createInstance()`.
3.  Clients connected to the `WatchPartyGateway` send events (chat, like, play, pause).
4.  The gateway finds the correct instance via `instanceManager.getInstance()` and appends the event to the instance's internal buffer.
5.  Every 10 minutes, `WatchPartyRoomManager.periodicFlushAll()` is triggered by a cron job, which calls `flush()` on all dirty instances.
6.  When a party's `end_time` is reached, its status becomes `FINISHED`. `WatchPartyService` calls `instanceManager.closeInstance()`, which performs a final flush and cleans up the instance.
7.  If the server is shut down, `WatchPartyRoomManager.shutdownFlushAll()` is called to perform a final emergency flush for all active instances.

## 4. Configuration (Environment Variables)

The behavior of the buffering system can be tweaked via environment variables. While defaults are provided, you can add these to your `.env` file:

-   `WATCH_PARTY_FLUSH_INTERVAL_MINUTES`: The interval for the periodic flush cron job. Default: `10`.
-   `WATCH_PARTY_SHUTDOWN_FLUSH_TIMEOUT_MS`: The maximum time (in milliseconds) to wait for the final flush on server shutdown before timing out. Default: `5000`.

*(Note: The implementation currently uses hardcoded values from `CronExpression.EVERY_10_MINUTES`. To make this configurable, the `@Cron` decorator would need to be replaced with a programmatic approach using `SchedulerRegistry`.)*

## 5. Error Handling & Recovery

-   **DB Errors during Flush**: If the `bulkInsertLogs` operation fails, the transaction is rolled back, and the error is logged. The instance's buffer is **not** cleared, and its `dirty` flag remains `true`. The flush will be automatically retried on the next periodic flush cycle.
-   **Server Crash**: With the current in-memory implementation, any data in the buffer that has not been flushed will be lost if the server process crashes unexpectedly.
    -   **Production Recommendation**: For a production environment with multiple nodes or higher data durability requirements, the `WatchPartyRoom`'s buffer should be backed by **Redis**. Events would be pushed to a Redis List or Stream. A separate worker process could then consume from Redis and persist to PostgreSQL, guaranteeing that no events are lost even if the main application nodes restart.
-   **Dead-Letter Queue (DLQ)**: The current implementation logs failed batches. For production, this should be enhanced to push the failed batch of data to a persistent queue (like a Redis list) for manual inspection and replay.

## 6. Monitoring

The system includes logging for key events:
-   Instance creation and closing.
-   Flush start, success, and failure.
-   Number of items flushed per batch.

For production, it is recommended to add metrics (e.g., using Prometheus) for:
-   `watch_party_buffered_events_count` (gauge)
-   `watch_party_flush_duration_ms` (histogram)
-   `watch_party_failed_flushes_total` (counter)
-   `watch_party_active_instances` (gauge)
